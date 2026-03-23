import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// ── Types returned by analytics queries ───────────────────────────────────────

export interface CompletionRow {
  nodeId: string;
  nodeCode: string;
  nodeName: unknown; // JSONB { en, ar, fr, es }
  total: number;
  submitted: number;
  approved: number;
  completionPct: number;
}

export interface OverdueRow {
  nodeId: string;
  nodeCode: string;
  nodeName: unknown;
  overdueCount: number;
}

export interface TurnaroundResult {
  campaignId: string;
  avgHours: number | null;
  sampleSize: number;
}

export interface FillDurationResult {
  campaignId: string;
  avgMinutes: number | null;
  sampleSize: number;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Submission completion rate per node, scoped to the subtree of `rootNodeId`.
   * Returns one row per leaf node that has at least one assignment.
   */
  async completionRate(campaignId: string, rootNodeId?: string): Promise<CompletionRow[]> {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      select: { ownerNodeId: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const scopeNodeId = rootNodeId ?? campaign.ownerNodeId;

    // Resolve all node IDs within the subtree (closure includes self at depth=0)
    const closureRows = await this.prisma.xeduClosure.findMany({
      where: { ancestorId: scopeNodeId },
      select: { descendantId: true },
    });
    const nodeIds = closureRows.map((r) => r.descendantId);

    // Aggregate assignments per node
    const rows = await this.prisma.submissionsAssignment.groupBy({
      by: ['assignedNodeId'],
      where: { campaignId, assignedNodeId: { in: nodeIds } },
      _count: { id: true },
    });

    if (rows.length === 0) return [];

    // Count submitted and approved separately
    const submittedRows = await this.prisma.submissionsAssignment.groupBy({
      by: ['assignedNodeId'],
      where: {
        campaignId,
        assignedNodeId: { in: nodeIds },
        status: { in: ['submitted', 'approved', 'rejected', 'forwarded'] },
      },
      _count: { id: true },
    });

    const approvedRows = await this.prisma.submissionsAssignment.groupBy({
      by: ['assignedNodeId'],
      where: {
        campaignId,
        assignedNodeId: { in: nodeIds },
        status: 'approved',
      },
      _count: { id: true },
    });

    // Fetch node metadata
    const nodeMap = new Map(
      (
        await this.prisma.xeduNode.findMany({
          where: { id: { in: rows.map((r) => r.assignedNodeId) } },
          select: { id: true, code: true, name: true },
        })
      ).map((n) => [n.id, n]),
    );

    const submittedMap = new Map(submittedRows.map((r) => [r.assignedNodeId, r._count.id]));
    const approvedMap = new Map(approvedRows.map((r) => [r.assignedNodeId, r._count.id]));

    return rows.map((r) => {
      const total = r._count.id;
      const submitted = submittedMap.get(r.assignedNodeId) ?? 0;
      const approved = approvedMap.get(r.assignedNodeId) ?? 0;
      const node = nodeMap.get(r.assignedNodeId);
      return {
        nodeId: r.assignedNodeId,
        nodeCode: node?.code ?? r.assignedNodeId,
        nodeName: node?.name ?? null,
        total,
        submitted,
        approved,
        completionPct: total > 0 ? Math.round((submitted / total) * 100) : 0,
      };
    });
  }

  /**
   * Overdue assignment counts per node (deadline < now, status pending or in_progress).
   */
  async overdueByNode(campaignId: string, rootNodeId?: string): Promise<OverdueRow[]> {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      select: { ownerNodeId: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const scopeNodeId = rootNodeId ?? campaign.ownerNodeId;
    const closureRows = await this.prisma.xeduClosure.findMany({
      where: { ancestorId: scopeNodeId },
      select: { descendantId: true },
    });
    const nodeIds = closureRows.map((r) => r.descendantId);
    const now = new Date();

    const rows = await this.prisma.submissionsAssignment.groupBy({
      by: ['assignedNodeId'],
      where: {
        campaignId,
        assignedNodeId: { in: nodeIds },
        status: { in: ['pending', 'in_progress'] },
        deadline: { lt: now },
      },
      _count: { id: true },
    });

    if (rows.length === 0) return [];

    const nodeMap = new Map(
      (
        await this.prisma.xeduNode.findMany({
          where: { id: { in: rows.map((r) => r.assignedNodeId) } },
          select: { id: true, code: true, name: true },
        })
      ).map((n) => [n.id, n]),
    );

    return rows.map((r) => {
      const node = nodeMap.get(r.assignedNodeId);
      return {
        nodeId: r.assignedNodeId,
        nodeCode: node?.code ?? r.assignedNodeId,
        nodeName: node?.name ?? null,
        overdueCount: r._count.id,
      };
    });
  }

  /**
   * Average approval turnaround time (submission → first approve event) in hours.
   */
  async turnaroundTime(campaignId: string): Promise<TurnaroundResult> {
    // Find all approved assignments for this campaign and their submissions
    const events = await this.prisma.approvalEvent.findMany({
      where: {
        action: 'approve',
        assignment: { campaignId },
      },
      select: {
        createdAt: true,
        submission: { select: { submittedAt: true } },
      },
    });

    const validPairs = events.filter((e) => e.submission.submittedAt !== null);

    if (validPairs.length === 0) {
      return { campaignId, avgHours: null, sampleSize: 0 };
    }

    const totalMs = validPairs.reduce((sum, e) => {
      const diff = e.createdAt.getTime() - e.submission.submittedAt!.getTime();
      return sum + diff;
    }, 0);

    const avgMs = totalMs / validPairs.length;
    return {
      campaignId,
      avgHours: Math.round((avgMs / 3_600_000) * 10) / 10,
      sampleSize: validPairs.length,
    };
  }

  /**
   * Average form fill duration (submission.createdAt → submittedAt) in minutes.
   */
  async fillDuration(campaignId: string): Promise<FillDurationResult> {
    const submissions = await this.prisma.submission.findMany({
      where: {
        assignment: { campaignId },
        status: { in: ['submitted', 'under_review', 'approved', 'rejected'] },
        submittedAt: { not: null },
      },
      select: { createdAt: true, submittedAt: true },
    });

    if (submissions.length === 0) {
      return { campaignId, avgMinutes: null, sampleSize: 0 };
    }

    const totalMs = submissions.reduce(
      (sum, s) => sum + (s.submittedAt!.getTime() - s.createdAt.getTime()),
      0,
    );

    const avgMs = totalMs / submissions.length;
    return {
      campaignId,
      avgMinutes: Math.round(avgMs / 60_000),
      sampleSize: submissions.length,
    };
  }

  /**
   * Summary stats for a campaign dashboard card.
   */
  async campaignSummary(campaignId: string) {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true, status: true, globalDeadline: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const now = new Date();

    const [total, submitted, approved, rejected, overdue, flagged] = await Promise.all([
      this.prisma.submissionsAssignment.count({ where: { campaignId } }),
      this.prisma.submissionsAssignment.count({
        where: { campaignId, status: { in: ['submitted', 'approved', 'rejected', 'forwarded'] } },
      }),
      this.prisma.submissionsAssignment.count({ where: { campaignId, status: 'approved' } }),
      this.prisma.submissionsAssignment.count({ where: { campaignId, status: 'rejected' } }),
      this.prisma.submissionsAssignment.count({
        where: { campaignId, status: { in: ['pending', 'in_progress'] }, deadline: { lt: now } },
      }),
      this.prisma.submissionsAssignment.count({ where: { campaignId, status: 'flagged' } }),
    ]);

    return {
      campaign,
      stats: {
        total,
        submitted,
        approved,
        rejected,
        overdue,
        flagged,
        pending: total - submitted - rejected,
        completionPct: total > 0 ? Math.round((submitted / total) * 100) : 0,
      },
    };
  }
}
