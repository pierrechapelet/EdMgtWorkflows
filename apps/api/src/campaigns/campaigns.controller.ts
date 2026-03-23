import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { AssignmentsService } from './assignments.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { AssignWorkflowDto } from './dto/assign-workflow.dto';
import { AssignmentQueryDto } from './dto/assignment-query.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  // ── Campaign CRUD ──────────────────────────────────────────────────────────

  @Get()
  async findAll(@Query() query: CampaignQueryDto) {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.campaignsService.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateCampaignDto) {
    return { data: await this.campaignsService.create(dto) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return { data: await this.campaignsService.update(id, dto) };
  }

  // ── Status transitions ─────────────────────────────────────────────────────

  @Post(':id/activate')
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.campaignsService.activate(id) };
  }

  @Post(':id/pause')
  async pause(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.campaignsService.pause(id) };
  }

  @Post(':id/recall')
  async recall(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.campaignsService.recall(id) };
  }

  @Post(':id/close')
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.campaignsService.close(id) };
  }

  // ── Workflow assignments ───────────────────────────────────────────────────

  @Post(':id/workflow-assignments')
  async assignWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkflowDto,
  ) {
    return { data: await this.campaignsService.assignWorkflow(id, dto) };
  }

  @Delete(':id/workflow-assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeWorkflowAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    await this.campaignsService.removeWorkflowAssignment(id, assignmentId);
  }

  // ── Submissions assignments (admin view for a campaign) ────────────────────

  @Get(':id/assignments')
  async getAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.findForCampaign(id, query);
  }
}
