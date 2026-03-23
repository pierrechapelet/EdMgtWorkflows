import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentQueryDto } from './dto/assignment-query.dto';

/**
 * Portal-facing endpoint: the authenticated user sees only their own assignments.
 */
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  async findMine(
    @Request() req: { user: { sub: string } },
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.findForUser(req.user.sub, query);
  }

  @Get(':id')
  async findOne(
    @Request() req: { user: { sub: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.assignmentsService.findOne(id, req.user.sub) };
  }
}
