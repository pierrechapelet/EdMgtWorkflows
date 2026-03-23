import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import {
  EscalationService,
  EscalationScheduler,
  EscalationProcessor,
  ESCALATION_QUEUE,
} from './escalation.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: ESCALATION_QUEUE }),
    CampaignsModule,
    NotificationsModule,
  ],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsService,
    EscalationService,
    EscalationScheduler,
    EscalationProcessor,
  ],
  exports: [ApprovalsService, EscalationService],
})
export class ApprovalsModule {}
