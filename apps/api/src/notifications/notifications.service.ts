import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DatabaseService } from '../database/database.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { EMAIL_QUEUE, EMAIL_JOB, EmailProcessor } from './email.processor';

export type NotificationType =
  | 'assignment_created'
  | 'deadline_approaching'
  | 'deadline_passed'
  | 'submission_received'
  | 'approved'
  | 'rejected'
  | 'campaign_recalled'
  | 'escalation_created';

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  sendEmail?: boolean;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: DatabaseService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    private readonly emailProcessor: EmailProcessor,
  ) {}

  onModuleInit() {
    // Wire the circular reference via setter to avoid DI circular dependency
    this.emailProcessor.setNotificationsService(this);
  }

  // ── Core notify ────────────────────────────────────────────────────────────

  /**
   * Creates an in-app notification and optionally queues an email via BullMQ.
   * Safe to fire-and-forget with `void`.
   */
  async notify(params: NotifyParams): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
          emailSent: !!params.sendEmail,
        },
      });

      if (params.sendEmail) {
        const user = await this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { email: true },
        });

        if (user) {
          await this.emailQueue.add(EMAIL_JOB, {
            to: user.email,
            subject: params.title,
            html: this.buildEmailHtml(params.title, params.body),
          });
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to send notification to ${params.userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Bulk-notify multiple users with the same notification content.
   * Used for campaign recall (many users at once).
   */
  async notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
    if (userIds.length === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: params.type,
          title: params.title,
          body: params.body,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
          emailSent: !!params.sendEmail,
        })),
        skipDuplicates: false,
      });

      if (params.sendEmail) {
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { email: true },
        });

        await Promise.all(
          users.map((u) =>
            this.emailQueue.add(EMAIL_JOB, {
              to: u.email,
              subject: params.title,
              html: this.buildEmailHtml(params.title, params.body),
            }),
          ),
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed bulk notify: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  async getForUser(userId: string, query: NotificationQueryDto) {
    const { page = 1, limit = 20, unreadOnly } = query;
    const skip = (page - 1) * limit;
    const where = { userId, ...(unreadOnly && { isRead: false }) };

    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ── Deadline reminder (called by BullMQ cron) ──────────────────────────────

  /**
   * Finds assignments with deadline within the next 23–25 hours that have not
   * yet been notified (notifiedAt IS NULL), sends reminders, then stamps notifiedAt.
   */
  async sendDeadlineReminders(): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 3_600_000);
    const windowEnd = new Date(now.getTime() + 25 * 3_600_000);

    const assignments = await this.prisma.submissionsAssignment.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        deadline: { gte: windowStart, lte: windowEnd },
        notifiedAt: null,
      },
      include: {
        campaign: { select: { id: true, title: true } },
      },
    });

    if (assignments.length === 0) return 0;

    const assignmentIds = assignments.map((a) => a.id);

    // Bulk-notify all at once grouped by (userId, campaignId) would be ideal, but
    // individual notify is simpler and correct. Use notifyMany per campaign group.
    const byCampaign = new Map<
      string,
      { title: string; userIds: string[]; campaignId: string }
    >();

    for (const a of assignments) {
      const campaignTitle =
        (a.campaign.title as Record<string, string>).en ?? 'Campaign';
      if (!byCampaign.has(a.campaignId)) {
        byCampaign.set(a.campaignId, {
          title: campaignTitle,
          userIds: [],
          campaignId: a.campaignId,
        });
      }
      byCampaign.get(a.campaignId)!.userIds.push(a.assignedTo);
    }

    for (const { title, userIds, campaignId } of byCampaign.values()) {
      void this.notifyMany(userIds, {
        type: 'deadline_approaching',
        title: `Deadline approaching: ${title}`,
        body: `Your assignment for "${title}" is due in less than 24 hours. Please submit before the deadline.`,
        entityType: 'campaign',
        entityId: campaignId,
        sendEmail: true,
      });
    }

    // Stamp notifiedAt to prevent duplicate reminders
    await this.prisma.submissionsAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: { notifiedAt: now },
    });

    return assignments.length;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildEmailHtml(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${this.escape(title)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="color:#1d4ed8;border-bottom:1px solid #e5e7eb;padding-bottom:12px;">
    ${this.escape(title)}
  </h2>
  <p style="line-height:1.6;">${this.escape(body)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#6b7280;">
    This is an automated notification from EdMgtWorkflows. Do not reply to this email.
  </p>
</body>
</html>`;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
