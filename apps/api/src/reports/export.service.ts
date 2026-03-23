import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DatabaseService } from '../database/database.service';

export const PDF_QUEUE = 'pdf';
export const PDF_JOB = 'generate-pdf';

export interface PdfJobPayload {
  campaignId: string;
  requestedBy: string;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: DatabaseService,
    @InjectQueue(PDF_QUEUE) private readonly pdfQueue: Queue,
  ) {}

  // ── Data loading ───────────────────────────────────────────────────────────

  private async loadCampaignData(campaignId: string) {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      include: {
        formVersion: {
          include: { components: { where: { parentId: null }, orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    // Fetch submitted submissions with all values
    const submissions = await this.prisma.submission.findMany({
      where: {
        assignment: { campaignId },
        status: { in: ['submitted', 'under_review', 'approved', 'rejected'] },
      },
      include: {
        values: true,
        assignment: {
          select: {
            assignedUser: { select: { email: true } },
            assignedNode: { select: { code: true, name: true } },
            status: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return { campaign, submissions };
  }

  /** Flat list of leaf components (no sections/groups) for column headers */
  private flatLeafComponents(campaign: Awaited<ReturnType<typeof this.loadCampaignData>>['campaign']) {
    return campaign.formVersion.components.filter(
      (c) => c.componentType !== 'section' && c.componentType !== 'conditional_group',
    );
  }

  private valueToString(value: {
    valueText: string | null;
    valueNumber: unknown;
    valueDate: Date | null;
    valueJson: unknown;
    valueFileKey: string | null;
  }): string {
    if (value.valueText !== null) return value.valueText;
    if (value.valueNumber !== null) return String(value.valueNumber);
    if (value.valueDate !== null) return value.valueDate!.toISOString().slice(0, 10);
    if (value.valueFileKey !== null) return value.valueFileKey;
    if (value.valueJson !== null) {
      const j = value.valueJson as Record<string, unknown>;
      if ('items' in j && Array.isArray(j.items)) return (j.items as string[]).join('; ');
      return JSON.stringify(value.valueJson);
    }
    return '';
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  async exportCsv(campaignId: string): Promise<{ filename: string; content: string }> {
    const { campaign, submissions } = await this.loadCampaignData(campaignId);
    const leafComponents = this.flatLeafComponents(campaign);

    const campaignTitle =
      (campaign.title as Record<string, string>).en ?? campaignId;

    // Header row
    const headers = [
      'submission_id',
      'submitted_by',
      'node_code',
      'assignment_status',
      'submitted_at',
      ...leafComponents.map((c) => {
        const label = (c.label as Record<string, string>).en ?? c.key;
        return label.replace(/[",\n\r]/g, ' ');
      }),
    ];

    const lines: string[] = [headers.map((h) => `"${h}"`).join(',')];

    for (const sub of submissions) {
      const valueMap = new Map(sub.values.map((v) => [v.componentId, v]));
      const row = [
        sub.id,
        sub.assignment.assignedUser?.email ?? '',
        sub.assignment.assignedNode?.code ?? '',
        sub.assignment.status,
        sub.submittedAt?.toISOString() ?? '',
        ...leafComponents.map((c) => {
          const val = valueMap.get(c.id);
          if (!val) return '';
          return this.valueToString(val).replace(/"/g, '""');
        }),
      ];
      lines.push(row.map((v) => `"${v}"`).join(','));
    }

    const filename = `${campaignTitle.replace(/\s+/g, '_')}_export.csv`;
    return { filename, content: lines.join('\n') };
  }

  // ── XLSX export ────────────────────────────────────────────────────────────

  async exportXlsx(campaignId: string): Promise<{ filename: string; buffer: Buffer }> {
    const { campaign, submissions } = await this.loadCampaignData(campaignId);
    const leafComponents = this.flatLeafComponents(campaign);

    const campaignTitle =
      (campaign.title as Record<string, string>).en ?? campaignId;

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EdMgtWorkflows';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Submissions', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Columns
    sheet.columns = [
      { header: 'Submission ID', key: 'id', width: 38 },
      { header: 'Submitted By', key: 'email', width: 28 },
      { header: 'Node', key: 'node', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Submitted At', key: 'submittedAt', width: 22 },
      ...leafComponents.map((c) => ({
        header: (c.label as Record<string, string>).en ?? c.key,
        key: c.id,
        width: 22,
      })),
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    for (const sub of submissions) {
      const valueMap = new Map(sub.values.map((v) => [v.componentId, v]));
      const rowData: Record<string, unknown> = {
        id: sub.id,
        email: sub.assignment.assignedUser?.email ?? '',
        node: sub.assignment.assignedNode?.code ?? '',
        status: sub.assignment.status,
        submittedAt: sub.submittedAt,
      };

      for (const c of leafComponents) {
        const val = valueMap.get(c.id);
        rowData[c.id] = val ? this.valueToString(val) : '';
      }

      const row = sheet.addRow(rowData);
      // Alternate row fill
      if (row.number % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } };
      }
    }

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Campaign', campaignTitle]);
    summarySheet.addRow(['Export date', new Date().toISOString()]);
    summarySheet.addRow(['Total submissions', submissions.length]);
    summarySheet.addRow([
      'Approved',
      submissions.filter((s) => s.assignment.status === 'approved').length,
    ]);
    summarySheet.addRow([
      'Rejected',
      submissions.filter((s) => s.assignment.status === 'rejected').length,
    ]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `${campaignTitle.replace(/\s+/g, '_')}_export.xlsx`;
    return { filename, buffer };
  }

  // ── PDF (async via BullMQ) ─────────────────────────────────────────────────

  async enqueuePdfExport(campaignId: string, requestedBy: string) {
    const job = await this.pdfQueue.add(
      PDF_JOB,
      { campaignId, requestedBy } satisfies PdfJobPayload,
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 50 },
    );
    return { jobId: String(job.id), status: 'queued' };
  }

  async getPdfJobStatus(jobId: string) {
    const job = await this.pdfQueue.getJob(jobId);
    if (!job) return { jobId, status: 'not_found' };

    const state = await job.getState();
    const result = job.returnvalue as { downloadUrl?: string } | undefined;

    return {
      jobId,
      status: state,
      downloadUrl: result?.downloadUrl ?? null,
      failedReason: job.failedReason ?? null,
    };
  }
}
