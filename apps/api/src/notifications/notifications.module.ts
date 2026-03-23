import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailProcessor, DeadlineScheduler, EMAIL_QUEUE } from './email.processor';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProcessor, DeadlineScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
