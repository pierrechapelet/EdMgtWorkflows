import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { UpdateWorkflowStepDto } from './dto/update-workflow-step.dto';

@Controller('workflows/:workflowId/steps')
export class WorkflowStepsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateWorkflowStepDto,
  ) {
    return { data: await this.workflowsService.createStep(workflowId, dto) };
  }

  @Patch(':stepId')
  async update(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: UpdateWorkflowStepDto,
  ) {
    return { data: await this.workflowsService.updateStep(workflowId, stepId, dto) };
  }

  @Delete(':stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    await this.workflowsService.deleteStep(workflowId, stepId);
  }
}
