import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  async findAll(@Query() query: WorkflowQueryDto) {
    return this.workflowsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.workflowsService.findOne(id) };
  }

  @Get(':id/graph')
  async getGraph(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.workflowsService.getGraph(id) };
  }

  @Post()
  async create(@Body() dto: CreateWorkflowDto, @Request() req: { user: { sub: string } }) {
    return { data: await this.workflowsService.create(dto, req.user.sub) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return { data: await this.workflowsService.update(id, dto) };
  }

  @Post(':id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.workflowsService.publish(id) };
  }
}
