import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue } from 'bull';
import { DatabaseService } from '../database/database.service';
import { AssignmentsService } from '../campaigns/assignments.service';
import { NotificationsService } from '../notifications/notifications.service';

export const ESCALATION_QUEUE = 'escalation';
export const ESCALATION_JOB = 'check-escalations';
export const EXPIRE_JOB = 'expire-overdue';

/**
 * Registers the repeatable BullMQ jobs on startup.
 */
@Injectable()
export class EscalationScheduler implements OnModuleInit {
  private readonly logger = new Logger(EscalationScheduler.name);

  constructor(
    @InjectQueue(ESCALATION_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    // Remove any stale repeatable jobs before re-registering to avoid duplicates
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Escalation check every 15 minutes
    await this.queue.add(
      ESCALATION_JOB,
      {},
      { repeat: { cron: '*/15 * * * *' }, removeOnComplete: true, removeOnFail: false },
    );

    // Deadline expiry check every 10 minutes
    await this.queue.add(
      EXPIRE_JOB,
      {},
      { repeat: { cron: '*/10 * * * *' }, removeOnComplete: true, removeOnFail: false },
    );

    this.logger.log('Escalation and expiry jobs scheduled');
  }
}

/**
 * BullMQ processor — runs escalation and expiry jobs.
 */
@Processor(ESCALATION_QUEUE)
export class EscalationProcessor {
  private readonly logger = new Logger(EscalationProcessor.name);

  constructor(
    private readonly escalationService: EscalationService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  @Process(ESCALATION_JOB)
  async handleEscalation() {
    const count = await this.escalationService.processEscalations();
    if (count > 0) {
      this.logger.log(`Escalated ${count} assignment(s)`);
    }
  }

  @Process(EXPIRE_JOB)
  async handleExpiry() {
    const count = await this.assignmentsService.expireOverdue();
    if (count > 0) {
      this.logger.log(`Expired ${count} overdue assignment(s)`);
    }
  }
}

/**
 * Core escalation business logic.
 *
 * Finds assignments that are:
 * - status in [pending, in_progress]
 * - deadline has passed
 * - workflowStep has an escalationStepId configured
 *
 * For each: creates a new assignment for the escalation target,
 * marks the original assignment as 'expired'.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly assignmentsService: AssignmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processEscalations(): Promise<number> {
    const now = new Date();

    const overdueAssignments = await this.prisma.submissionsAssignment.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        deadline: { lt: now },
        workflowStep: {
          escalationStepId: { not: null },
        },
      },
      include: {
        campaign: { select: { title: true } },
        workflowStep: {
          select: {
            escalationStepId: true,
            escalationRoleId: true,
            escalationNodeId: true,
            escalationNodeRel: true,
            escalationStep: {
              select: { id: true, deadlineOffsetHours: true },
            },
          },
        },
      },
    });

    let escalated = 0;

    for (const assignment of overdueAssignments) {
      const step = assignment.workflowStep;
      if (!step.escalationStepId) continue;

      try {
        // Resolve the escalation target user
        const targetUserId = await this.resolveEscalationTarget(
          step.escalationRoleId,
          step.escalationNodeId ?? step.escalationNodeRel
            ? await this.resolveEscalationNode(step.escalationNodeRel, assignment.assignedNodeId)
            : assignment.assignedNodeId,
        );

        if (!targetUserId) {
          this.logger.warn(
            `No escalation target found for assignment ${assignment.id} — skipping`,
          );
          // Still expire the original assignment
          await this.prisma.submissionsAssignment.update({
            where: { id: assignment.id },
            data: { status: 'expired' },
          });
          continue;
        }

        const escalationNodeId = step.escalationNodeId
          ?? (step.escalationNodeRel
            ? await this.resolveEscalationNode(step.escalationNodeRel, assignment.assignedNodeId)
            : assignment.assignedNodeId)
          ?? assignment.assignedNodeId;

        // Create escalation assignment + expire original in a transaction
        const escalationDeadlineHours = step.escalationStep?.deadlineOffsetHours;
        const escalationDeadline = escalationDeadlineHours
          ? new Date(now.getTime() + escalationDeadlineHours * 3_600_000)
          : null;

        const [, escalationAssignment] = await this.prisma.$transaction([
          this.prisma.submissionsAssignment.update({
            where: { id: assignment.id },
            data: { status: 'expired' },
          }),
          this.prisma.submissionsAssignment.create({
            data: {
              campaignId: assignment.campaignId,
              workflowStepId: step.escalationStepId,
              assignedTo: targetUserId,
              assignedNodeId: escalationNodeId,
              status: 'pending',
              deadline: escalationDeadline,
              notifiedAt: now, // pre-stamp; we notify below
            },
          }),
        ]);

        // Notify escalation target
        const campaignTitle =
          (assignment.campaign?.title as Record<string, string> | undefined)?.en ?? 'Campaign';
        void this.notificationsService.notify({
          userId: targetUserId,
          type: 'escalation_created',
          title: `Escalated assignment: ${campaignTitle}`,
          body: `An overdue assignment for "${campaignTitle}" has been escalated to you.`,
          entityType: 'assignment',
          entityId: escalationAssignment.id,
          sendEmail: true,
        });

        escalated++;
      } catch (err: unknown) {
        this.logger.error(
          `Failed to escalate assignment ${assignment.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return escalated;
  }

  private async resolveEscalationTarget(
    roleId: string | null,
    nodeId: string | null,
  ): Promise<string | null> {
    if (!roleId || !nodeId) return null;

    const now = new Date();
    const ura = await this.prisma.userRoleAssignment.findFirst({
      where: {
        roleId,
        xeduNodeId: nodeId,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { userId: true },
    });

    return ura?.userId ?? null;
  }

  private async resolveEscalationNode(
    rel: string | null,
    currentNodeId: string,
  ): Promise<string | null> {
    if (!rel) return currentNodeId;

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
      default:
        return currentNodeId;
    }
  }
}
