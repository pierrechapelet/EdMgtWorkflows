import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SubmissionsService } from './submissions.service';
import { SyncSubmissionDto } from './dto/sync-submission.dto';
import { Prisma } from '@prisma/client';

export type SyncResultStatus = 'synced' | 'flagged' | 'error';

export interface SyncResult {
  assignmentId: string;
  status: SyncResultStatus;
  submissionId?: string;
  flags: string[];
  message?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  /**
   * Process a batch of offline submissions.
   * Each item is validated independently; failures are flagged, never rejected.
   */
  async syncBatch(userId: string, items: SyncSubmissionDto[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const item of items) {
      const result = await this.syncOne(userId, item);
      results.push(result);
    }

    return results;
  }

  private async syncOne(userId: string, dto: SyncSubmissionDto): Promise<SyncResult> {
    const flags: string[] = [];

    try {
      // 1. Verify assignment belongs to this user
      const assignment = await this.prisma.submissionsAssignment.findUnique({
        where: { id: dto.assignmentId },
        include: {
          campaign: {
            select: {
              status: true,
              globalDeadline: true,
              formVersionId: true,
              formVersion: { select: { id: true, versionNumber: true } },
            },
          },
        },
      });

      if (!assignment || assignment.assignedTo !== userId) {
        return {
          assignmentId: dto.assignmentId,
          status: 'error',
          flags: ['assignment_not_found'],
          message: 'Assignment not found or not accessible',
        };
      }

      // 2. Check campaign status
      if (assignment.campaign.status === 'recalled') {
        flags.push('campaign_recalled');
      } else if (!['active', 'paused'].includes(assignment.campaign.status)) {
        flags.push(`campaign_${assignment.campaign.status}`);
      }

      // 3. Check deadline
      if (assignment.deadline && assignment.deadline < new Date()) {
        flags.push('deadline_passed');
      }

      // 4. Check form version match
      const clientVersionId = dto.values[0] ? assignment.campaign.formVersionId : null;
      if (clientVersionId && clientVersionId !== assignment.campaign.formVersionId) {
        flags.push(
          `version_mismatch:expected=${assignment.campaign.formVersionId}`,
        );
      }

      // 5. Upsert or create submission (always store, flag if needed)
      let submission = await this.prisma.submission.findFirst({
        where: { assignmentId: dto.assignmentId, status: 'draft' },
      });

      const isFlagged = flags.length > 0;
      const submissionStatus = isFlagged
        ? 'flagged'
        : dto.submit
          ? 'submitted'
          : 'draft';

      if (submission) {
        submission = await this.prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: submissionStatus,
            offlineFlag: true,
            conflictReason: isFlagged ? flags.join('; ') : null,
            submittedAt: dto.submit && !isFlagged ? new Date() : null,
          },
        });
      } else {
        submission = await this.prisma.submission.create({
          data: {
            assignmentId: dto.assignmentId,
            formVersionId: assignment.campaign.formVersionId,
            submittedBy: userId,
            status: submissionStatus,
            offlineFlag: true,
            conflictReason: isFlagged ? flags.join('; ') : null,
            submittedAt: dto.submit && !isFlagged ? new Date() : null,
          },
        });
      }

      // 6. Upsert values
      for (const v of dto.values) {
        await this.prisma.submissionValue.upsert({
          where: {
            submissionId_componentId: {
              submissionId: submission.id,
              componentId: v.componentId,
            },
          },
          create: {
            submissionId: submission.id,
            componentId: v.componentId,
            valueText: v.valueText ?? null,
            valueNumber: v.valueNumber ?? null,
            valueDate: v.valueDate ? new Date(v.valueDate) : null,
            valueJson: v.valueJson ?? Prisma.JsonNull,
            valueFileKey: v.valueFileKey ?? null,
          },
          update: {
            valueText: v.valueText ?? null,
            valueNumber: v.valueNumber ?? null,
            valueDate: v.valueDate ? new Date(v.valueDate) : null,
            valueJson: v.valueJson ?? Prisma.JsonNull,
            valueFileKey: v.valueFileKey ?? null,
          },
        });
      }

      // 7. Write to sync_queue log for audit / manual review
      await this.prisma.syncQueue.create({
        data: {
          deviceId: dto.deviceId,
          userId,
          payload: {
            assignmentId: dto.assignmentId,
            submissionId: submission.id,
            clientTimestamp: dto.clientTimestamp,
            valueCount: dto.values.length,
          } as unknown as Prisma.InputJsonValue,
          status: isFlagged ? 'conflict' : 'processed',
          conflictDetails: isFlagged
            ? ({ flags } as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      // 8. Advance assignment status if clean submit
      if (!isFlagged && dto.submit) {
        await this.prisma.submissionsAssignment.update({
          where: { id: dto.assignmentId },
          data: { status: 'submitted' },
        });
      } else if (!isFlagged && submission.status === 'draft') {
        await this.prisma.submissionsAssignment.updateMany({
          where: { id: dto.assignmentId, status: 'pending' },
          data: { status: 'in_progress' },
        });
      }

      return {
        assignmentId: dto.assignmentId,
        submissionId: submission.id,
        status: isFlagged ? 'flagged' : 'synced',
        flags,
      };
    } catch (err: unknown) {
      return {
        assignmentId: dto.assignmentId,
        status: 'error',
        flags: ['internal_error'],
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
