import { Controller, Post, Body, Request } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './dto/sync-submission.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /sync/submissions
   *
   * Accepts a batch of offline submissions. Each is processed independently:
   * - Clean submissions: saved/submitted normally
   * - Conflicting submissions: stored with status='flagged' for manual review
   *
   * Always returns HTTP 200 with per-item results so the client can clear
   * its offline queue and display appropriate status to the user.
   */
  @Post('submissions')
  async syncSubmissions(
    @Body() dto: SyncBatchDto,
    @Request() req: { user: { sub: string } },
  ) {
    const results = await this.syncService.syncBatch(req.user.sub, dto.submissions);
    return { data: results };
  }
}
