import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitSubmissionDto } from './dto/submit-submission.dto';
import { RequestUploadUrlDto } from './dto/upload-file.dto';
import { Prisma } from '@prisma/client';

// AWS SDK v3 — optional dependency; only imported when S3_BUCKET_FILES is set
let S3Client: typeof import('@aws-sdk/client-s3').S3Client;
let PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;
let getSignedUrl: typeof import('@aws-sdk/s3-request-presigner').getSignedUrl;

async function loadAwsSdk() {
  if (!S3Client) {
    const s3Mod = await import('@aws-sdk/client-s3');
    const presignMod = await import('@aws-sdk/s3-request-presigner');
    S3Client = s3Mod.S3Client;
    PutObjectCommand = s3Mod.PutObjectCommand;
    getSignedUrl = presignMod.getSignedUrl;
  }
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Read ───────────────────────────────────────────────────────────────────

  async findOne(submissionId: string, requestingUserId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            assignedTo: true,
            campaign: {
              select: {
                title: true,
                formTemplate: { select: { code: true, title: true } },
                formVersion: { select: { versionNumber: true } },
              },
            },
          },
        },
        values: { orderBy: { componentId: 'asc' } },
        formVersion: { select: { id: true, versionNumber: true, schema: true } },
      },
    });

    if (!submission) throw new NotFoundException(`Submission ${submissionId} not found`);
    if (submission.assignment.assignedTo !== requestingUserId) {
      throw new ForbiddenException('Not your submission');
    }
    return submission;
  }

  async findForAssignment(assignmentId: string, requestingUserId: string) {
    const assignment = await this.prisma.submissionsAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        assignedTo: true,
        campaignId: true,
        campaign: { select: { formVersionId: true } },
      },
    });
    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    if (assignment.assignedTo !== requestingUserId) {
      throw new ForbiddenException('Not your assignment');
    }

    return this.prisma.submission.findMany({
      where: { assignmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        values: true,
        formVersion: { select: { id: true, versionNumber: true } },
      },
    });
  }

  // ── Draft ──────────────────────────────────────────────────────────────────

  /**
   * Creates or retrieves the active draft for an assignment.
   * Returns the draft submission with its current values.
   */
  async getOrCreateDraft(assignmentId: string, userId: string) {
    const assignment = await this.validateAssignmentOwner(assignmentId, userId);

    let draft = await this.prisma.submission.findFirst({
      where: { assignmentId, status: 'draft' },
      include: {
        values: { orderBy: { componentId: 'asc' } },
        formVersion: { select: { id: true, versionNumber: true, schema: true } },
      },
    });

    if (!draft) {
      draft = await this.prisma.submission.create({
        data: {
          assignmentId,
          formVersionId: assignment.campaign.formVersionId,
          submittedBy: userId,
          status: 'draft',
          offlineFlag: false,
        },
        include: {
          values: true,
          formVersion: { select: { id: true, versionNumber: true, schema: true } },
        },
      });

      // Mark assignment as in_progress
      await this.prisma.submissionsAssignment.update({
        where: { id: assignmentId },
        data: { status: 'in_progress' },
      });
    }

    return draft;
  }

  async saveDraft(assignmentId: string, userId: string, dto: SaveDraftDto) {
    const draft = await this.getOrCreateDraft(assignmentId, userId);

    // Upsert all provided values
    for (const v of dto.values) {
      await this.prisma.submissionValue.upsert({
        where: {
          submissionId_componentId: {
            submissionId: draft.id,
            componentId: v.componentId,
          },
        },
        create: {
          submissionId: draft.id,
          componentId: v.componentId,
          valueText: v.valueText ?? null,
          valueNumber: v.valueNumber ?? null,
          valueDate: v.valueDate ? new Date(v.valueDate) : null,
          valueJson: v.valueJson ?? Prisma.JsonNull,
          valueFileKey: v.valueFileKey ?? null,
        },
        update: {
          valueText: v.valueText ?? null,
          valueNumber: v.valueNumber ?? null,
          valueDate: v.valueDate ? new Date(v.valueDate) : null,
          valueJson: v.valueJson ?? Prisma.JsonNull,
          valueFileKey: v.valueFileKey ?? null,
        },
      });
    }

    // Re-fetch with updated values
    return this.prisma.submission.findUniqueOrThrow({
      where: { id: draft.id },
      include: {
        values: { orderBy: { componentId: 'asc' } },
        formVersion: { select: { id: true, versionNumber: true, schema: true } },
      },
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async submit(assignmentId: string, userId: string, dto: SubmitSubmissionDto) {
    const assignment = await this.validateAssignmentOwner(assignmentId, userId);

    // Validate campaign is still active
    if (assignment.campaign.status !== 'active') {
      throw new BadRequestException(
        `Cannot submit: campaign is "${assignment.campaign.status}"`,
      );
    }

    // Validate deadline
    const latestAssignment = await this.prisma.submissionsAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    if (latestAssignment.deadline && latestAssignment.deadline < new Date()) {
      throw new BadRequestException('Submission deadline has passed');
    }

    // Upsert final values
    const savedDraft = await this.saveDraft(assignmentId, userId, { values: dto.values });

    // Compute signature hash
    const signatureHash = this.computeSignatureHash(
      savedDraft.values,
      dto.signatureImageBase64,
      dto.signatureTypedName,
    );

    // Mark as submitted
    const submitted = await this.prisma.submission.update({
      where: { id: savedDraft.id },
      data: {
        status: 'submitted',
        signatureHash,
        submittedAt: new Date(),
        offlineFlag: false,
      },
      include: {
        values: { orderBy: { componentId: 'asc' } },
        formVersion: { select: { id: true, versionNumber: true } },
      },
    });

    // Mark assignment as submitted
    await this.prisma.submissionsAssignment.update({
      where: { id: assignmentId },
      data: { status: 'submitted' },
    });

    return submitted;
  }

  // ── File upload ────────────────────────────────────────────────────────────

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    await this.validateAssignmentOwner(dto.assignmentId, userId);

    const bucket = this.config.get<string>('S3_BUCKET_FILES');
    if (!bucket) {
      throw new BadRequestException('File upload is not configured');
    }

    await loadAwsSdk();

    const key = `submissions/${dto.assignmentId}/${Date.now()}-${dto.filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 128)}`;

    const client = new S3Client({
      region: this.config.get('AWS_REGION', 'us-east-1'),
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return { uploadUrl, key };
  }

  // ── Signature hash ─────────────────────────────────────────────────────────

  /**
   * SHA-256( canonical_values_json + ":" + signature_bytes_hex )
   *
   * canonical_values_json = JSON.stringify of values array sorted by componentId,
   * with only stable fields included (componentId, valueText, valueNumber,
   * valueDate, valueJson, valueFileKey).
   */
  private computeSignatureHash(
    values: Array<{
      componentId: string;
      valueText: string | null;
      valueNumber: number | null;
      valueDate: Date | null;
      valueJson: unknown;
      valueFileKey: string | null;
    }>,
    signatureImageBase64?: string,
    signatureTypedName?: string,
  ): string | null {
    if (!signatureImageBase64 && !signatureTypedName) return null;

    const canonical = JSON.stringify(
      [...values]
        .sort((a, b) => a.componentId.localeCompare(b.componentId))
        .map((v) => ({
          c: v.componentId,
          t: v.valueText,
          n: v.valueNumber,
          d: v.valueDate?.toISOString() ?? null,
          j: v.valueJson,
          f: v.valueFileKey,
        })),
    );

    const sigPart = signatureImageBase64
      ? Buffer.from(signatureImageBase64, 'base64').toString('hex')
      : signatureTypedName ?? '';

    return createHash('sha256')
      .update(`${canonical}:${sigPart}`)
      .digest('hex');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async validateAssignmentOwner(assignmentId: string, userId: string) {
    const assignment = await this.prisma.submissionsAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          select: {
            formVersionId: true,
            status: true,
            globalDeadline: true,
          },
        },
      },
    });

    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    if (assignment.assignedTo !== userId) {
      throw new ForbiddenException('Not your assignment');
    }

    return assignment;
  }
}
