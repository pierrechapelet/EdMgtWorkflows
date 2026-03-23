import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CreateXeduNodeDto } from './dto/create-xedu-node.dto';
import { UpdateXeduNodeDto } from './dto/update-xedu-node.dto';
import { CreateXeduEdgeDto } from './dto/create-xedu-edge.dto';
import { XeduNodeQueryDto, XeduEdgeQueryDto } from './dto/xedu-query.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class XeduService {
  private readonly logger = new Logger(XeduService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Nodes ─────────────────────────────────────────────────────────────────

  async createNode(dto: CreateXeduNodeDto) {
    // Generate a deterministic code from nodeType + uuid
    const code = `${dto.nodeType.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const node = await this.prisma.xeduNode.create({
      data: {
        code,
        nodeType: dto.nodeType,
        name: dto.name as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Every node is its own ancestor at depth 0
    await this.prisma.xeduClosure.create({
      data: { ancestorId: node.id, descendantId: node.id, depth: 0 },
    });

    return node;
  }

  async findNodes(query: XeduNodeQueryDto) {
    const { page = 1, limit = 20, nodeType, isActive, ancestorNodeId, search } = query;
    const skip = (page - 1) * limit;

    // If filtering by ancestor, first fetch all descendants
    let descendantIds: string[] | undefined;
    if (ancestorNodeId) {
      const closure = await this.prisma.xeduClosure.findMany({
        where: { ancestorId: ancestorNodeId },
        select: { descendantId: true },
      });
      descendantIds = closure.map((c) => c.descendantId);
    }

    const where: Prisma.XeduNodeWhereInput = {
      ...(nodeType !== undefined && { nodeType }),
      ...(isActive !== undefined && { isActive }),
      ...(descendantIds && { id: { in: descendantIds } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          // Search in multilingual name JSON
          {
            name: {
              path: ['en'],
              string_contains: search,
            },
          },
          {
            name: {
              path: ['ar'],
              string_contains: search,
            },
          },
          {
            name: {
              path: ['fr'],
              string_contains: search,
            },
          },
        ],
      }),
    };

    const [nodes, total] = await Promise.all([
      this.prisma.xeduNode.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nodeType: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.xeduNode.count({ where }),
    ]);

    return { data: nodes, meta: buildPaginationMeta(total, page, limit) };
  }

  async findNode(id: string) {
    const node = await this.prisma.xeduNode.findUnique({
      where: { id },
      include: {
        fromEdges: { include: { toNode: { select: { id: true, code: true, name: true, nodeType: true } } } },
        toEdges: { include: { fromNode: { select: { id: true, code: true, name: true, nodeType: true } } } },
      },
    });
    if (!node) throw new AppException('NODE_NOT_FOUND', 'Xedu node not found', 404);
    return node;
  }

  async updateNode(id: string, dto: UpdateXeduNodeDto) {
    await this.assertNodeExists(id);
    return this.prisma.xeduNode.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivateNode(id: string) {
    await this.assertNodeExists(id);
    return this.prisma.xeduNode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Graph traversal ────────────────────────────────────────────────────────

  async getAncestors(nodeId: string) {
    await this.assertNodeExists(nodeId);
    const entries = await this.prisma.xeduClosure.findMany({
      where: { descendantId: nodeId, depth: { gt: 0 } },
      include: { ancestor: { select: { id: true, code: true, name: true, nodeType: true, isActive: true } } },
      orderBy: { depth: 'asc' },
    });
    return entries.map((e) => ({ ...e.ancestor, depth: e.depth }));
  }

  async getDescendants(nodeId: string) {
    await this.assertNodeExists(nodeId);
    const entries = await this.prisma.xeduClosure.findMany({
      where: { ancestorId: nodeId, depth: { gt: 0 } },
      include: { descendant: { select: { id: true, code: true, name: true, nodeType: true, isActive: true } } },
      orderBy: { depth: 'asc' },
    });
    return entries.map((e) => ({ ...e.descendant, depth: e.depth }));
  }

  async getSubtree(nodeId: string) {
    // Returns the node plus all descendants, structured as a flat list with depth
    await this.assertNodeExists(nodeId);
    const root = await this.prisma.xeduNode.findUnique({
      where: { id: nodeId },
      select: { id: true, code: true, name: true, nodeType: true, isActive: true },
    });
    const descendants = await this.getDescendants(nodeId);
    return [{ ...root, depth: 0 }, ...descendants];
  }

  // ─── Edges ──────────────────────────────────────────────────────────────────

  async createEdge(dto: CreateXeduEdgeDto) {
    // Self-loops are not allowed
    if (dto.fromNodeId === dto.toNodeId) {
      throw new AppException('INVALID_EDGE', 'Self-loops are not allowed', 400);
    }

    // Check both nodes exist
    await this.assertNodeExists(dto.fromNodeId);
    await this.assertNodeExists(dto.toNodeId);

    // For hierarchical edges: check for cycle (toNode must not already be an ancestor of fromNode)
    if (dto.edgeType === 'hierarchical') {
      const wouldCreateCycle = await this.prisma.xeduClosure.findFirst({
        where: { ancestorId: dto.toNodeId, descendantId: dto.fromNodeId },
      });
      if (wouldCreateCycle) {
        throw new AppException(
          'GRAPH_CYCLE',
          'Adding this hierarchical edge would create a cycle in the graph',
          400,
        );
      }
    }

    const edge = await this.prisma.xeduEdge.create({
      data: {
        fromNodeId: dto.fromNodeId,
        toNodeId: dto.toNodeId,
        edgeType: dto.edgeType,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        fromNode: { select: { id: true, code: true, name: true } },
        toNode: { select: { id: true, code: true, name: true } },
      },
    });

    // Rebuild closure table when a hierarchical edge is added
    if (dto.edgeType === 'hierarchical') {
      await this.rebuildClosure();
    }

    return edge;
  }

  async findEdges(query: XeduEdgeQueryDto) {
    const { page = 1, limit = 20, fromNodeId, toNodeId, edgeType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.XeduEdgeWhereInput = {
      ...(fromNodeId && { fromNodeId }),
      ...(toNodeId && { toNodeId }),
      ...(edgeType && { edgeType }),
    };

    const [edges, total] = await Promise.all([
      this.prisma.xeduEdge.findMany({
        where,
        skip,
        take: limit,
        include: {
          fromNode: { select: { id: true, code: true, name: true, nodeType: true } },
          toNode: { select: { id: true, code: true, name: true, nodeType: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.xeduEdge.count({ where }),
    ]);

    return { data: edges, meta: buildPaginationMeta(total, page, limit) };
  }

  async deleteEdge(id: string) {
    const edge = await this.prisma.xeduEdge.findUnique({ where: { id } });
    if (!edge) throw new AppException('EDGE_NOT_FOUND', 'Edge not found', 404);

    await this.prisma.xeduEdge.delete({ where: { id } });

    // Rebuild closure if a hierarchical edge was removed
    if (edge.edgeType === 'hierarchical') {
      await this.rebuildClosure();
    }

    return { success: true };
  }

  // ─── Closure table ──────────────────────────────────────────────────────────

  /**
   * Rebuilds the entire xedu_closure table from scratch using a PostgreSQL
   * recursive CTE. Includes only hierarchical edges.
   * Runs inside a transaction to avoid partial state.
   *
   * Performance: O(N²) in worst case but acceptable for thousands of nodes.
   * Called only on hierarchical edge mutations.
   */
  async rebuildClosure() {
    this.logger.log('Rebuilding Xedu closure table...');

    await this.prisma.$transaction([
      // Step 1: Clear existing closure
      this.prisma.$executeRaw`DELETE FROM xedu_closure`,

      // Step 2: Rebuild via recursive CTE
      // MIN(depth) handles DAG (multiple paths — keep shortest)
      this.prisma.$executeRaw`
        WITH RECURSIVE cte AS (
          -- Base case: every node is its own ancestor at depth 0
          SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth
          FROM xedu_nodes

          UNION ALL

          -- Recursive case: follow hierarchical edges downward
          SELECT cte.ancestor_id,
                 e.to_node_id AS descendant_id,
                 cte.depth + 1 AS depth
          FROM   cte
          JOIN   xedu_edges e
                 ON  e.from_node_id = cte.descendant_id
                 AND e.edge_type    = 'hierarchical'
        )
        INSERT INTO xedu_closure (ancestor_id, descendant_id, depth)
        SELECT   ancestor_id,
                 descendant_id,
                 MIN(depth) AS depth
        FROM     cte
        GROUP BY ancestor_id, descendant_id
        ON CONFLICT (ancestor_id, descendant_id)
        DO UPDATE SET depth = EXCLUDED.depth
      `,
    ]);

    this.logger.log('Closure table rebuild complete');
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertNodeExists(id: string) {
    const node = await this.prisma.xeduNode.findUnique({ where: { id } });
    if (!node) throw new AppException('NODE_NOT_FOUND', `Xedu node ${id} not found`, 404);
    return node;
  }
}
