import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
import { PermissionAction } from '@edmgt/shared-types';
import { Prisma } from '@prisma/client';

export interface PermissionCheckParams {
  userId: string;
  action: PermissionAction;
  componentId?: string;
  workflowStepId?: string;
  formTemplateId?: string;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Resolution engine ─────────────────────────────────────────────────────

  /**
   * Core permission resolution algorithm.
   *
   * Grant if ANY row in component_permissions matches:
   *   role IN user_roles
   *   AND xedu_node IN (user_nodes + ALL ancestors via xedu_closure, hierarchical only)
   *   AND (component = requested OR component IS NULL)
   *   AND (workflow_step = requested OR step IS NULL)
   *   AND (form_template = requested OR template IS NULL)
   *   AND <action_column> = true
   *
   * Null fields act as wildcards (applies to everything).
   */
  async check(params: PermissionCheckParams): Promise<boolean> {
    // Step 1: Resolve user's active role(s) and xedu node(s)
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId: params.userId,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { roleId: true, xeduNodeId: true },
    });

    if (assignments.length === 0) return false;

    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const directNodeIds = [...new Set(assignments.map((a) => a.xeduNodeId))];

    // Step 2: Expand xedu nodes to include all ancestors (hierarchical path upward)
    // A permission granted at a parent node propagates down to children (if inheritsToChildren=true),
    // so we check if the user's node or any of its ancestors have a matching permission.
    const ancestorEntries = await this.prisma.xeduClosure.findMany({
      where: { descendantId: { in: directNodeIds } },
      select: { ancestorId: true },
    });

    const allNodeIds = [
      ...new Set([
        ...directNodeIds,
        ...ancestorEntries.map((e) => e.ancestorId),
      ]),
    ];

    // Step 3: Build the action filter
    const actionFilter = this.buildActionFilter(params.action);

    // Step 4: Query component_permissions
    const match = await this.prisma.componentPermission.findFirst({
      where: {
        roleId: { in: roleIds },
        ...actionFilter,
        AND: [
          // Node: user's direct nodes or any ancestor, or null (global permission)
          {
            OR: [
              { xeduNodeId: { in: allNodeIds } },
              { xeduNodeId: null },
            ],
          },
          // Component: specific or null (global — applies to all components)
          params.componentId
            ? { OR: [{ componentId: params.componentId }, { componentId: null }] }
            : { componentId: null },
          // Workflow step: specific or null (applies to all steps)
          params.workflowStepId
            ? { OR: [{ workflowStepId: params.workflowStepId }, { workflowStepId: null }] }
            : { workflowStepId: null },
          // Form template: specific or null (applies to all templates)
          params.formTemplateId
            ? { OR: [{ formTemplateId: params.formTemplateId }, { formTemplateId: null }] }
            : { formTemplateId: null },
        ],
      },
    });

    return match !== null;
  }

  /**
   * Returns the full permission matrix for a user:
   * all granted actions across all their role assignments and ancestor nodes.
   * Useful for building permission-aware UIs.
   */
  async getEffectivePermissions(userId: string) {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { roleId: true, xeduNodeId: true },
    });

    if (assignments.length === 0) return [];

    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const directNodeIds = [...new Set(assignments.map((a) => a.xeduNodeId))];

    const ancestorEntries = await this.prisma.xeduClosure.findMany({
      where: { descendantId: { in: directNodeIds } },
      select: { ancestorId: true },
    });

    const allNodeIds = [
      ...new Set([...directNodeIds, ...ancestorEntries.map((e) => e.ancestorId)]),
    ];

    return this.prisma.componentPermission.findMany({
      where: {
        roleId: { in: roleIds },
        OR: [{ xeduNodeId: { in: allNodeIds } }, { xeduNodeId: null }],
      },
      include: {
        role: { select: { id: true, code: true, name: true } },
        xeduNode: { select: { id: true, code: true, name: true } },
        formTemplate: { select: { id: true, code: true, title: true } },
      },
    });
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreatePermissionDto) {
    return this.prisma.componentPermission.create({
      data: {
        roleId: dto.roleId,
        xeduNodeId: dto.xeduNodeId ?? null,
        formTemplateId: dto.formTemplateId ?? null,
        componentId: dto.componentId ?? null,
        workflowStepId: dto.workflowStepId ?? null,
        canRead: dto.canRead ?? false,
        canWrite: dto.canWrite ?? false,
        canCreate: dto.canCreate ?? false,
        canDelete: dto.canDelete ?? false,
        canApprove: dto.canApprove ?? false,
        canReject: dto.canReject ?? false,
        canForward: dto.canForward ?? false,
        inheritsToChildren: dto.inheritsToChildren ?? true,
      },
      include: {
        role: { select: { id: true, code: true, name: true } },
        xeduNode: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findAll(query: PermissionQueryDto) {
    const { page = 1, limit = 20, roleId, xeduNodeId, formTemplateId, componentId, workflowStepId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ComponentPermissionWhereInput = {
      ...(roleId && { roleId }),
      ...(xeduNodeId && { xeduNodeId }),
      ...(formTemplateId && { formTemplateId }),
      ...(componentId && { componentId }),
      ...(workflowStepId && { workflowStepId }),
    };

    const [permissions, total] = await Promise.all([
      this.prisma.componentPermission.findMany({
        where,
        skip,
        take: limit,
        include: {
          role: { select: { id: true, code: true, name: true } },
          xeduNode: { select: { id: true, code: true, name: true } },
          formTemplate: { select: { id: true, code: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.componentPermission.count({ where }),
    ]);

    return { data: permissions, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const p = await this.prisma.componentPermission.findUnique({
      where: { id },
      include: { role: true, xeduNode: true },
    });
    if (!p) throw new AppException('PERMISSION_NOT_FOUND', 'Permission not found', 404);
    return p;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.findOne(id);
    return this.prisma.componentPermission.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.componentPermission.delete({ where: { id } });
    return { success: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private buildActionFilter(action: PermissionAction): Prisma.ComponentPermissionWhereInput {
    switch (action) {
      case PermissionAction.READ:    return { canRead: true };
      case PermissionAction.WRITE:   return { canWrite: true };
      case PermissionAction.CREATE:  return { canCreate: true };
      case PermissionAction.DELETE:  return { canDelete: true };
      case PermissionAction.APPROVE: return { canApprove: true };
      case PermissionAction.REJECT:  return { canReject: true };
      case PermissionAction.FORWARD: return { canForward: true };
    }
  }
}
