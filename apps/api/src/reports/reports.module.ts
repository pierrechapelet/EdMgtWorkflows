import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../database/database.module';
import { ReportsService } from './reports.service';
import { ExportService, PDF_QUEUE } from './export.service';
import { GeoService } from './geo.service';
import { PdfProcessor } from './pdf.processor';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: PDF_QUEUE }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService, GeoService, PdfProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
