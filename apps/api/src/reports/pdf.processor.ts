import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DatabaseService } from '../database/database.service';
import { PDF_QUEUE, PDF_JOB, PdfJobPayload } from './export.service';

/**
 * BullMQ worker that generates a PDF of all submissions for a campaign.
 *
 * Uses Puppeteer to render an HTML snapshot of the consolidated submissions
 * table and saves the resulting PDF to S3.
 *
 * NOTE: In production this worker runs inside a dedicated ECS Fargate task
 * (separate from the main API) that has Chrome / Chromium installed.
 * The queue name must match the one registered in ExportService.
 */
@Processor(PDF_QUEUE)
export class PdfProcessor {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(private readonly prisma: DatabaseService) {}

  @Process(PDF_JOB)
  async generatePdf(job: Job<PdfJobPayload>): Promise<{ downloadUrl: string }> {
    const { campaignId, requestedBy } = job.data;
    this.logger.log(`Generating PDF for campaign ${campaignId}, requested by ${requestedBy}`);

    // ── Load data ────────────────────────────────────────────────────────────
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id: campaignId },
      include: {
        formVersion: {
          include: {
            components: {
              where: { parentId: null, componentType: { notIn: ['section', 'conditional_group'] } },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const submissions = await this.prisma.submission.findMany({
      where: {
        assignment: { campaignId },
        status: { in: ['submitted', 'under_review', 'approved', 'rejected'] },
      },
      include: {
        values: true,
        assignment: {
          select: {
            status: true,
            assignedUser: { select: { email: true } },
            assignedNode: { select: { code: true } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // ── Build HTML ────────────────────────────────────────────────────────────
    const title = (campaign.title as Record<string, string>).en ?? campaignId;
    const components = campaign.formVersion.components;

    const headerCells = [
      'Node',
      'Submitted By',
      'Status',
      'Submitted At',
      ...components.map((c) => (c.label as Record<string, string>).en ?? c.key),
    ]
      .map((h) => `<th>${this.esc(h)}</th>`)
      .join('');

    const bodyRows = submissions
      .map((s) => {
        const valueMap = new Map(s.values.map((v) => [v.componentId, v]));
        const cells = [
          s.assignment.assignedNode?.code ?? '',
          s.assignment.assignedUser?.email ?? '',
          s.assignment.status,
          s.submittedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '',
          ...components.map((c) => {
            const v = valueMap.get(c.id);
            if (!v) return '';
            if (v.valueText !== null) return v.valueText;
            if (v.valueNumber !== null) return String(v.valueNumber);
            if (v.valueDate !== null) return v.valueDate.toISOString().slice(0, 10);
            if (v.valueFileKey !== null) return '[file]';
            return '';
          }),
        ]
          .map((val) => `<td>${this.esc(String(val))}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10px; padding: 16px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p  { font-size: 11px; color: #555; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1D4ED8; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8faff; }
  </style>
</head>
<body>
  <h1>${this.esc(title)} — Submissions Report</h1>
  <p>Generated: ${new Date().toISOString()} · Total: ${submissions.length}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

    // ── Render with Puppeteer ─────────────────────────────────────────────────
    // Dynamic import keeps the heavy Puppeteer dependency out of the module
    // initialization path. The ECS worker image includes a bundled Chromium.
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBytes = await page.pdf({ format: 'A4', landscape: true, printBackground: true });

      // ── Upload to S3 ────────────────────────────────────────────────────────
      const s3Key = `reports/${campaignId}/${Date.now()}-submissions.pdf`;
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const s3 = new S3Client({ region: process.env.AWS_REGION });
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_PDFS,
          Key: s3Key,
          Body: pdfBytes,
          ContentType: 'application/pdf',
          ServerSideEncryption: 'AES256',
        }),
      );

      const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET_PDFS, Key: s3Key }),
        { expiresIn: 3600 },
      );

      this.logger.log(`PDF for campaign ${campaignId} uploaded to ${s3Key}`);
      return { downloadUrl };
    } finally {
      await browser.close();
    }
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
