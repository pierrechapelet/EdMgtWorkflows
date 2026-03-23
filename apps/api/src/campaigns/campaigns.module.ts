import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { AssignmentsService } from './assignments.service';
import { CampaignsController } from './campaigns.controller';
import { AssignmentsController } from './assignments.controller';

@Module({
  controllers: [CampaignsController, AssignmentsController],
  providers: [CampaignsService, AssignmentsService],
  exports: [CampaignsService, AssignmentsService],
})
export class CampaignsModule {}
