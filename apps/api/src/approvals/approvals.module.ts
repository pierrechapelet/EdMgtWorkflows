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

@Module({
  imports: [
    BullModule.registerQueue({ name: ESCALATION_QUEUE }),
    // Import CampaignsModule to access AssignmentsService
    CampaignsModule,
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
