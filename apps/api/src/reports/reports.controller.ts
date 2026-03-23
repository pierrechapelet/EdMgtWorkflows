import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { GeoService } from './geo.service';
import { ReportQueryDto, ExportFormat, ExportQueryDto, GeoQueryDto } from './dto/report-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports/campaigns/:campaignId')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exports: ExportService,
    private readonly geo: GeoService,
  ) {}

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('summary')
  async summary(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
    const data = await this.reports.campaignSummary(campaignId);
    return { data };
  }

  @Get('completion')
  async completion(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() q: ReportQueryDto,
  ) {
    const data = await this.reports.completionRate(campaignId, q.nodeId);
    return { data };
  }

  @Get('overdue')
  async overdue(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() q: ReportQueryDto,
  ) {
    const data = await this.reports.overdueByNode(campaignId, q.nodeId);
    return { data };
  }

  @Get('turnaround')
  async turnaround(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
    const data = await this.reports.turnaroundTime(campaignId);
    return { data };
  }

  @Get('fill-duration')
  async fillDuration(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
    const data = await this.reports.fillDuration(campaignId);
    return { data };
  }

  // ── Geo ───────────────────────────────────────────────────────────────────

  @Get('geo')
  async geoPoints(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() q: GeoQueryDto,
  ) {
    const data = await this.geo.getGeoPoints(campaignId, q.bbox);
    return { data };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  @Get('export')
  async exportData(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() q: ExportQueryDto,
    @Res() res: Response,
  ) {
    if (q.format === ExportFormat.Xlsx) {
      const { filename, buffer } = await this.exports.exportXlsx(campaignId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } else {
      const { filename, content } = await this.exports.exportCsv(campaignId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    }
  }

  @Post('export/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueuePdf(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.exports.enqueuePdfExport(campaignId, user.id);
    return { data };
  }

  @Get('export/pdf/:jobId')
  async pdfJobStatus(
    @Param('campaignId', ParseUUIDPipe) _campaignId: string,
    @Param('jobId') jobId: string,
  ) {
    const data = await this.exports.getPdfJobStatus(jobId);
    return { data };
  }
}
