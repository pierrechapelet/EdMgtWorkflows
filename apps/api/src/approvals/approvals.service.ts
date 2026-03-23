import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AssignmentsService } from '../campaigns/assignments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TakeActionDto, ApprovalActionEnum } from './dto/take-action.dto';

// Map approval actions → workflow trigger actions used in transitions
const ACTION_TO_TRIGGER: Record<ApprovalActionEnum, string> = {
  [ApprovalActionEnum.Approve]: 'approve',
  [ApprovalActionEnum.Reject]: 'reject',
  [ApprovalActionEnum.Forward]: 'forward',
  [ApprovalActionEnum.RequestCorrection]: 'reject', // treated as reject-back-to-fill
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly assignmentsService: AssignmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Take action ────────────────────────────────────────────────────────────

  /**
   * Core approval flow:
   * 1. Validate actor owns this assignment and it has a submitted/pending submission
   * 2. Look up the workflow transition for (step, triggerAction)
   * 3. If transition exists → advance to next step, creating a new assignment
   * 4. If no transition → terminal action; mark submission final
   * 5. Record an approval_event
   */
  async takeAction(assignmentId: string, actorId: string, dto: TakeActionDto) {
    const assignment = await this.prisma.submissionsAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        workflowStep: {
          include: {
            workflow: {
              select: { id: true },
            },
            outgoingTransitions: {
              include: {
                toStep: true,
              },
            },
          },
        },
        campaign: {
          select: {
            status: true,
            title: true,
          },
        },
      },
    });

    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    if (assignment.assignedTo !== actorId) throw new ForbiddenException('Not your assignment');
    if (!['pending', 'in_progress', 'submitted'].includes(assignment.status)) {
      throw new BadRequestException(
        `Assignment status "${assignment.status}" does not allow further actions`,
      );
    }

    // Get the submitted submission for this assignment
    const submission = await this.prisma.submission.findFirst({
      where: { assignmentId, status: { in: ['submitted', 'draft'] } },
      orderBy: { submittedAt: 'desc' },
    });
    if (!submission) {
      throw new BadRequestException('No submission found for this assignment');
    }

    const triggerAction = ACTION_TO_TRIGGER[dto.action];
    const transition = assignment.workflowStep.outgoingTransitions.find(
      (t) => t.triggerAction === triggerAction,
    );

    let nextAssignmentId: string | null = null;

    if (transition) {
      const nextStep = transition.toStep;

      // Resolve the target user for the next step
      const { targetUserId, targetNodeId } = await this.resolveNextAssignee(
        nextStep,
        assignment.assignedNodeId,
        assignment.campaignId,
      );

      if (targetUserId) {
        const terminalStatus = dto.action === ApprovalActionEnum.Approve
          ? 'approved'
          : dto.action === ApprovalActionEnum.Forward
            ? 'forwarded'
            : 'rejected';

        const next = await this.assignmentsService.advanceToNextStep(
          assignmentId,
          nextStep.id,
          targetUserId,
          targetNodeId ?? assignment.assignedNodeId,
          terminalStatus,
        );
        nextAssignmentId = next.id;
      } else {
        // No matching assignee found — mark current assignment with action status
        await this.markTerminal(assignmentId, dto.action, submission.id);
      }
    } else {
      // No outgoing transition — terminal action
      await this.markTerminal(assignmentId, dto.action, submission.id);
    }

    // ── Notifications ────────────────────────────────────────────────────────
    const campaignTitle =
      (assignment.campaign?.title as Record<string, string> | undefined)?.en ?? 'Campaign';

    // Notify the submitter of the final outcome (approved / rejected)
    const isApprove = dto.action === ApprovalActionEnum.Approve;
    const isReject =
      dto.action === ApprovalActionEnum.Reject ||
      dto.action === ApprovalActionEnum.RequestCorrection;

    if (!nextAssignmentId) {
      // Terminal action — notify original submitter
      if (isApprove) {
        void this.notificationsService.notify({
          userId: submission.submittedById,
          type: 'approved',
          title: `Submission approved: ${campaignTitle}`,
          body: `Your submission for "${campaignTitle}" has been approved.`,
          entityType: 'submission',
          entityId: submission.id,
          sendEmail: true,
        });
      } else if (isReject) {
        void this.notificationsService.notify({
          userId: submission.submittedById,
          type: 'rejected',
          title: `Submission rejected: ${campaignTitle}`,
          body:
            dto.action === ApprovalActionEnum.RequestCorrection
              ? `Your submission for "${campaignTitle}" requires correction.`
              : `Your submission for "${campaignTitle}" has been rejected.`,
          entityType: 'submission',
          entityId: submission.id,
          sendEmail: true,
        });
      }
    }
    // Note: submission_received notification for the next step is sent by advanceToNextStep
    // ─────────────────────────────────────────────────────────────────────────

    // Record approval event
    const event = await this.prisma.approvalEvent.create({
      data: {
        submissionId: submission.id,
        assignmentId,
        workflowStepId: assignment.workflowStepId,
        actorId,
        action: dto.action,
        comment: dto.comment ?? null,
      },
      include: {
        actor: { select: { id: true, email: true } },
        workflowStep: { select: { id: true, name: true, stepType: true } },
      },
    });

    return { event, nextAssignmentId };
  }

  // ── Approval history ───────────────────────────────────────────────────────

  async getHistory(submissionId: string) {
    return this.prisma.approvalEvent.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, email: true } },
        workflowStep: { select: { id: true, name: true, stepType: true } },
      },
    });
  }

  async getAssignmentHistory(assignmentId: string) {
    return this.prisma.approvalEvent.findMany({
      where: { assignmentId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, email: true } },
        workflowStep: { select: { id: true, name: true, stepType: true } },
      },
    });
  }

  // ── Flagged submissions (manual review queue) ──────────────────────────────

  async getFlaggedSubmissions(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.submission.findMany({
        where: { status: 'flagged' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignment: {
            select: {
              assignedUser: { select: { id: true, email: true } },
              assignedNode: { select: { id: true, code: true, name: true } },
              campaign: {
                select: {
                  title: true,
                  formTemplate: { select: { code: true, title: true } },
                },
              },
            },
          },
          formVersion: { select: { id: true, versionNumber: true } },
        },
      }),
      this.prisma.submission.count({ where: { status: 'flagged' } }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async markTerminal(
    assignmentId: string,
    action: ApprovalActionEnum,
    submissionId: string,
  ) {
    const terminalAssignmentStatus =
      action === ApprovalActionEnum.Approve
        ? 'approved'
        : action === ApprovalActionEnum.Forward
          ? 'forwarded'
          : 'rejected';

    const terminalSubmissionStatus =
      action === ApprovalActionEnum.Approve ? 'approved' : 'rejected';

    await this.prisma.$transaction([
      this.prisma.submissionsAssignment.update({
        where: { id: assignmentId },
        data: { status: terminalAssignmentStatus },
      }),
      this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: terminalSubmissionStatus },
      }),
    ]);
  }

  /**
   * Resolves the target user for the next workflow step.
   *
   * Resolution order:
   * 1. If the step has a fixed assigneeNodeId + assigneeRoleId → find user at that node with that role
   * 2. If the step uses assigneeNodeRel (parent/ancestor/peer) → resolve relative node, then find user
   * 3. Falls back to the campaign owner node
   */
  private async resolveNextAssignee(
    nextStep: {
      id: string;
      assigneeRoleId: string | null;
      assigneeNodeId: string | null;
      assigneeNodeRel: string | null;
    },
    currentNodeId: string,
    campaignId: string,
  ): Promise<{ targetUserId: string | null; targetNodeId: string | null }> {
    let targetNodeId: string | null = nextStep.assigneeNodeId;

    if (!targetNodeId && nextStep.assigneeNodeRel) {
      targetNodeId = await this.resolveNodeByRel(nextStep.assigneeNodeRel, currentNodeId);
    }

    if (!targetNodeId) targetNodeId = currentNodeId;

    if (!nextStep.assigneeRoleId) {
      return { targetUserId: null, targetNodeId };
    }

    const now = new Date();
    const ura = await this.prisma.userRoleAssignment.findFirst({
      where: {
        roleId: nextStep.assigneeRoleId,
        xeduNodeId: targetNodeId,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { userId: true },
    });

    return { targetUserId: ura?.userId ?? null, targetNodeId };
  }

  private async resolveNodeByRel(rel: string, currentNodeId: string): Promise<string | null> {
    switch (rel) {
      case 'parent': {
        const edge = await this.prisma.xeduEdge.findFirst({
          where: { toNodeId: currentNodeId, edgeType: 'hierarchical' },
          select: { fromNodeId: true },
        });
        return edge?.fromNodeId ?? null;
      }
      case 'ancestor': {
        const closure = await this.prisma.xeduClosure.findFirst({
          where: { descendantId: currentNodeId, depth: { gt: 0 } },
          orderBy: { depth: 'asc' },
          select: { ancestorId: true },
        });
        return closure?.ancestorId ?? null;
      }
      case 'peer': {
        // Find a sibling node (same parent, different node)
        const parent = await this.prisma.xeduEdge.findFirst({
          where: { toNodeId: currentNodeId, edgeType: 'hierarchical' },
          select: { fromNodeId: true },
        });
        if (!parent) return null;
        const sibling = await this.prisma.xeduEdge.findFirst({
          where: {
            fromNodeId: parent.fromNodeId,
            edgeType: 'hierarchical',
            toNodeId: { not: currentNodeId },
          },
          select: { toNodeId: true },
        });
        return sibling?.toNodeId ?? null;
      }
      case 'absolute':
      default:
        return null;
    }
  }
}
