import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowStepsController } from './workflow-steps.controller';
import { WorkflowTransitionsController } from './workflow-transitions.controller';

@Module({
  controllers: [WorkflowsController, WorkflowStepsController, WorkflowTransitionsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
