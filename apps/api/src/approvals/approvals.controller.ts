import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { TakeActionDto } from './dto/take-action.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * POST /approvals/:assignmentId/action
   * Takes an approval action (approve/reject/forward/request_correction)
   * on the submission tied to this assignment.
   */
  @Post(':assignmentId/action')
  async takeAction(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: TakeActionDto,
    @Request() req: { user: { sub: string } },
  ) {
    return {
      data: await this.approvalsService.takeAction(assignmentId, req.user.sub, dto),
    };
  }

  /** GET /approvals/submission/:submissionId/history */
  @Get('submission/:submissionId/history')
  async getSubmissionHistory(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return { data: await this.approvalsService.getHistory(submissionId) };
  }

  /** GET /approvals/assignment/:assignmentId/history */
  @Get('assignment/:assignmentId/history')
  async getAssignmentHistory(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return { data: await this.approvalsService.getAssignmentHistory(assignmentId) };
  }

  /** GET /approvals/flagged — admin manual review queue */
  @Get('flagged')
  async getFlagged(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.approvalsService.getFlaggedSubmissions({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }
}
