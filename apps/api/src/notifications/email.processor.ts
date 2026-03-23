import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export const EMAIL_QUEUE = 'email';
export const EMAIL_JOB = 'send-email';
export const DEADLINE_CHECK_JOB = 'deadline-check';

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Schedules the deadline-approaching check cron job on startup.
 */
@Injectable()
export class DeadlineScheduler implements OnModuleInit {
  private readonly logger = new Logger(DeadlineScheduler.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs.filter((j) => j.name === DEADLINE_CHECK_JOB)) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Run hourly — finds assignments with deadline within 24h window
    await this.queue.add(
      DEADLINE_CHECK_JOB,
      {},
      { repeat: { cron: '0 * * * *' }, removeOnComplete: true, removeOnFail: false },
    );

    this.logger.log('Deadline reminder job scheduled (hourly)');
  }
}

/**
 * Processes email and deadline-check jobs from the email queue.
 * Email delivery uses AWS SES (SDK loaded lazily to avoid startup cost when SES env is missing).
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  // NotificationsService injected via setter to avoid circular dependency at construction time
  private notificationsServiceRef: { sendDeadlineReminders(): Promise<number> } | null = null;

  setNotificationsService(svc: { sendDeadlineReminders(): Promise<number> }) {
    this.notificationsServiceRef = svc;
  }

  @Process(EMAIL_JOB)
  async handleSendEmail(job: Job<EmailJobPayload>) {
    const { to, subject, html } = job.data;

    const fromAddress = process.env.SES_FROM_ADDRESS ?? 'noreply@example.com';
    const region = process.env.AWS_REGION ?? 'us-east-1';

    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      const ses = new SESClient({ region });

      await ses.send(
        new SendEmailCommand({
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' } },
          },
          Source: fromAddress,
        }),
      );

      this.logger.debug(`Email sent to ${to}: ${subject}`);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err; // BullMQ will retry based on queue configuration
    }
  }

  @Process(DEADLINE_CHECK_JOB)
  async handleDeadlineCheck() {
    if (!this.notificationsServiceRef) return;
    const count = await this.notificationsServiceRef.sendDeadlineReminders();
    if (count > 0) {
      this.logger.log(`Sent ${count} deadline reminder(s)`);
    }
  }
}
