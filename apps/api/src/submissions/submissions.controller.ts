import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitSubmissionDto } from './dto/submit-submission.dto';
import { RequestUploadUrlDto } from './dto/upload-file.dto';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  /** Get a specific submission (owner only) */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return { data: await this.submissionsService.findOne(id, req.user.sub) };
  }

  /** Get or create draft for an assignment */
  @Get('draft/:assignmentId')
  async getDraft(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return {
      data: await this.submissionsService.getOrCreateDraft(assignmentId, req.user.sub),
    };
  }

  /** All submissions for an assignment */
  @Get('by-assignment/:assignmentId')
  async getByAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return {
      data: await this.submissionsService.findForAssignment(assignmentId, req.user.sub),
    };
  }

  /** Autosave draft values */
  @Post('draft/:assignmentId')
  async saveDraft(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SaveDraftDto,
    @Request() req: { user: { sub: string } },
  ) {
    return {
      data: await this.submissionsService.saveDraft(assignmentId, req.user.sub, dto),
    };
  }

  /** Final submission */
  @Post('submit/:assignmentId')
  async submit(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SubmitSubmissionDto,
    @Request() req: { user: { sub: string } },
  ) {
    return {
      data: await this.submissionsService.submit(assignmentId, req.user.sub, dto),
    };
  }

  /** Request a presigned S3 upload URL */
  @Post('upload-url')
  async requestUploadUrl(
    @Body() dto: RequestUploadUrlDto,
    @Request() req: { user: { sub: string } },
  ) {
    return { data: await this.submissionsService.requestUploadUrl(req.user.sub, dto) };
  }
}
