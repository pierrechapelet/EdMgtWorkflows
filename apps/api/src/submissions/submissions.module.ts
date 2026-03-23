import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  controllers: [SubmissionsController, SyncController],
  providers: [SubmissionsService, SyncService],
  exports: [SubmissionsService, SyncService],
})
export class SubmissionsModule {}
