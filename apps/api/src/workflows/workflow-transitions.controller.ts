import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';

@Controller('workflows/:workflowId/transitions')
export class WorkflowTransitionsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateWorkflowTransitionDto,
  ) {
    return { data: await this.workflowsService.createTransition(workflowId, dto) };
  }

  @Delete(':transitionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('transitionId', ParseUUIDPipe) transitionId: string,
  ) {
    await this.workflowsService.deleteTransition(workflowId, transitionId);
  }
}
