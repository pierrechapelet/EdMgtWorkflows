import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Returns assignments visible to a given user.
   * Users see only assignments where they are the assigned user.
   */
  async findForUser(userId: string, query: AssignmentQueryDto) {
    const { campaignId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SubmissionsAssignmentWhereInput = {
      assignedTo: userId,
      ...(campaignId && { campaignId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.submissionsAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
        include: {
          campaign: {
            select: {
              id: true,
              title: true,
              status: true,
              globalDeadline: true,
              formTemplate: { select: { id: true, code: true, title: true } },
              formVersion: { select: { id: true, versionNumber: true } },
            },
          },
          workflowStep: { select: { id: true, name: true, stepType: true } },
          assignedNode: { select: { id: true, code: true, name: true, nodeType: true } },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.submissionsAssignment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Admin view — all assignments for a campaign.
   */
  async findForCampaign(campaignId: string, query: AssignmentQueryDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SubmissionsAssignmentWhereInput = {
      campaignId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.submissionsAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
        include: {
          assignedUser: { select: { id: true, email: true } },
          workflowStep: { select: { id: true, name: true, stepType: true } },
          assignedNode: { select: { id: true, code: true, name: true, nodeType: true } },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.submissionsAssignment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId?: string) {
    const assignment = await this.prisma.submissionsAssignment.findUnique({
      where: { id, ...(userId && { assignedTo: userId }) },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            globalDeadline: true,
            formTemplate: { select: { id: true, code: true, title: true } },
            formVersion: { select: { id: true, versionNumber: true, schema: true } },
          },
        },
        workflowStep: {
          select: {
            id: true,
            name: true,
            stepType: true,
            deadlineOffsetHours: true,
          },
        },
        assignedUser: { select: { id: true, email: true } },
        assignedNode: { select: { id: true, code: true, name: true, nodeType: true } },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, submittedAt: true },
        },
      },
    });

    if (!assignment) throw new NotFoundException(`Assignment ${id} not found`);
    return assignment;
  }

  // ── Resolution engine ──────────────────────────────────────────────────────

  /**
   * Called when a campaign is activated for the first time.
   *
   * For each campaign_workflow_assignment:
   *   1. Find the first (fill) step of the assigned workflow
   *   2. Expand target node to include all descendants via closure table
   *   3. Find users who hold the step's required role at any of those nodes
   *      (via active user_role_assignments)
   *   4. Create one submissions_assignment per (user, node) pair — deduplicated
   *
   * Deadline = campaign global deadline OR per-node deadlineOverride,
   *            further offset by step.deadlineOffsetHours if set.
   */
  async resolveAndCreate(campaignId: string): Promise<number> {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      include: {
        workflowAssignments: {
          include: {
            workflow: {
              include: {
                steps: {
                  orderBy: { orderIndex: 'asc' },
                  take: 1, // first step only
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    let totalCreated = 0;
    const now = new Date();

    for (const wa of campaign.workflowAssignments) {
      const firstStep = wa.workflow.steps[0];
      if (!firstStep) continue;

      // Expand target node subtree (hierarchical descendants + the node itself)
      const closureRows = await this.prisma.xeduClosure.findMany({
        where: { ancestorId: wa.targetNodeId },
        select: { descendantId: true },
      });
      const nodeIds = closureRows.map((r) => r.descendantId);

      // Find users with the required role at any of these nodes
      // active = validFrom <= now AND (validUntil IS NULL OR validUntil > now)
      const roleFilter = firstStep.assigneeRoleId
        ? { roleId: firstStep.assigneeRoleId }
        : {};

      const userRoleAssignments = await this.prisma.userRoleAssignment.findMany({
        where: {
          ...roleFilter,
          xeduNodeId: { in: nodeIds },
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        select: { userId: true, xeduNodeId: true },
        distinct: ['userId', 'xeduNodeId'],
      });

      if (userRoleAssignments.length === 0) continue;

      // Compute deadline
      const baseDeadline = wa.deadlineOverride ?? campaign.globalDeadline;
      const stepOffsetMs = firstStep.deadlineOffsetHours
        ? firstStep.deadlineOffsetHours * 3_600_000
        : 0;
      const deadline = baseDeadline
        ? new Date(baseDeadline.getTime() + stepOffsetMs)
        : stepOffsetMs
          ? new Date(now.getTime() + stepOffsetMs)
          : null;

      // Create assignments — skip duplicates
      const records = userRoleAssignments.map((ura) => ({
        campaignId,
        workflowStepId: firstStep.id,
        assignedTo: ura.userId,
        assignedNodeId: ura.xeduNodeId,
        status: 'pending' as const,
        deadline,
      }));

      // Use createMany with skipDuplicates for idempotency
      const result = await this.prisma.submissionsAssignment.createMany({
        data: records,
        skipDuplicates: true,
      });

      totalCreated += result.count;
    }

    // Notify all newly-created (unnotified) assignments for this campaign
    if (totalCreated > 0) {
      void this.notifyUnnotified(campaignId);
    }

    return totalCreated;
  }

  /**
   * Queries unnotified assignments for a campaign and sends assignment_created notifications.
   * Stamps notifiedAt to prevent repeat sends.
   */
  private async notifyUnnotified(campaignId: string): Promise<void> {
    const unnotified = await this.prisma.submissionsAssignment.findMany({
      where: { campaignId, notifiedAt: null },
      include: {
        campaign: { select: { title: true } },
      },
    });

    if (unnotified.length === 0) return;

    const now = new Date();

    // Group by campaign title (all same campaign here, but keep it generic)
    const campaignTitle =
      (unnotified[0].campaign.title as Record<string, string>).en ?? 'Campaign';

    const userIds = [...new Set(unnotified.map((a) => a.assignedTo))];

    void this.notificationsService.notifyMany(userIds, {
      type: 'assignment_created',
      title: `New assignment: ${campaignTitle}`,
      body: `You have been assigned to fill out a form for the campaign "${campaignTitle}".`,
      entityType: 'campaign',
      entityId: campaignId,
      sendEmail: true,
    });

    await this.prisma.submissionsAssignment.updateMany({
      where: { id: { in: unnotified.map((a) => a.id) } },
      data: { notifiedAt: now },
    });
  }

  /**
   * Advances a submission to the next workflow step.
   * Called by the Approvals module (Phase 7); exposed here for cohesion.
   *
   * Creates a new SubmissionsAssignment for the target step's assignee,
   * marks the current assignment as the given terminal status.
   */
  async advanceToNextStep(
    currentAssignmentId: string,
    nextStepId: string,
    targetUserId: string,
    targetNodeId: string,
    terminalStatus: 'approved' | 'rejected' | 'forwarded',
  ) {
    const current = await this.prisma.submissionsAssignment.findUniqueOrThrow({
      where: { id: currentAssignmentId },
      include: {
        workflowStep: { select: { deadlineOffsetHours: true } },
      },
    });

    const nextStep = await this.prisma.workflowStep.findUniqueOrThrow({
      where: { id: nextStepId },
    });

    const now = new Date();
    const deadline = nextStep.deadlineOffsetHours
      ? new Date(now.getTime() + nextStep.deadlineOffsetHours * 3_600_000)
      : null;

    const [, nextAssignment] = await this.prisma.$transaction([
      this.prisma.submissionsAssignment.update({
        where: { id: currentAssignmentId },
        data: { status: terminalStatus },
      }),
      this.prisma.submissionsAssignment.create({
        data: {
          campaignId: current.campaignId,
          workflowStepId: nextStepId,
          assignedTo: targetUserId,
          assignedNodeId: targetNodeId,
          status: 'pending',
          deadline,
          notifiedAt: new Date(), // stamp immediately; notification sent below
        },
      }),
    ]);

    // Notify the new assignee about the incoming submission
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: current.campaignId },
      select: { title: true },
    });
    const campaignTitle = campaign
      ? ((campaign.title as Record<string, string>).en ?? 'Campaign')
      : 'Campaign';

    void this.notificationsService.notify({
      userId: targetUserId,
      type: 'submission_received',
      title: `New submission to review: ${campaignTitle}`,
      body: `A submission is awaiting your review for the campaign "${campaignTitle}".`,
      entityType: 'assignment',
      entityId: nextAssignment.id,
      sendEmail: true,
    });

    return nextAssignment;
  }

  // ── Deadline expiry (called by BullMQ scheduler, Phase 7) ─────────────────

  async expireOverdue() {
    const now = new Date();
    const result = await this.prisma.submissionsAssignment.updateMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        deadline: { lt: now },
      },
      data: { status: 'expired' },
    });
    return result.count;
  }
}
