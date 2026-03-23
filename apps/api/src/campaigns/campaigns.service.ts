import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { AssignWorkflowDto } from './dto/assign-workflow.dto';
import { AssignmentsService } from './assignments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly assignmentsService: AssignmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async findAll(query: CampaignQueryDto) {
    const { ownerNodeId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FormCampaignWhereInput = {
      ...(ownerNodeId && { ownerNodeId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.formCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
          formTemplate: { select: { id: true, code: true, title: true } },
          formVersion: { select: { id: true, versionNumber: true } },
          _count: {
            select: { workflowAssignments: true, submissionsAssignments: true },
          },
        },
      }),
      this.prisma.formCampaign.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.formCampaign.findUnique({
      where: { id },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        formTemplate: { select: { id: true, code: true, title: true } },
        formVersion: { select: { id: true, versionNumber: true, schema: true } },
        workflowAssignments: {
          include: {
            targetNode: { select: { id: true, code: true, name: true, nodeType: true } },
            workflow: {
              select: {
                id: true,
                name: true,
                isPublished: true,
                _count: { select: { steps: true } },
              },
            },
          },
        },
        _count: { select: { submissionsAssignments: true } },
      },
    });

    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async create(dto: CreateCampaignDto) {
    // Verify form template and its current published version
    const template = await this.prisma.formTemplate.findUnique({
      where: { id: dto.formTemplateId },
      include: { currentVersion: true },
    });
    if (!template) throw new NotFoundException(`Form template ${dto.formTemplateId} not found`);
    if (!template.currentVersionId || !template.currentVersion?.isPublished) {
      throw new BadRequestException('Form template has no published version');
    }

    const ownerNode = await this.prisma.xeduNode.findUnique({ where: { id: dto.ownerNodeId } });
    if (!ownerNode) throw new NotFoundException(`Xedu node ${dto.ownerNodeId} not found`);

    return this.prisma.formCampaign.create({
      data: {
        title: dto.title,
        formTemplateId: dto.formTemplateId,
        formVersionId: template.currentVersionId,
        ownerNodeId: dto.ownerNodeId,
        status: 'draft',
        globalDeadline: dto.globalDeadline ? new Date(dto.globalDeadline) : null,
      },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        formTemplate: { select: { id: true, code: true, title: true } },
        formVersion: { select: { id: true, versionNumber: true } },
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(id);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Only draft campaigns can be updated');
    }

    return this.prisma.formCampaign.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.globalDeadline !== undefined && {
          globalDeadline: dto.globalDeadline ? new Date(dto.globalDeadline) : null,
        }),
      },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        formTemplate: { select: { id: true, code: true, title: true } },
        formVersion: { select: { id: true, versionNumber: true } },
      },
    });
  }

  // ── Status transitions ─────────────────────────────────────────────────────

  async activate(id: string) {
    const campaign = await this.findOne(id);

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new BadRequestException(`Cannot activate a campaign in "${campaign.status}" status`);
    }

    if (campaign.workflowAssignments.length === 0) {
      throw new BadRequestException(
        'Campaign must have at least one workflow assignment before activation',
      );
    }

    // Validate all assigned workflows are published
    const unpublished = campaign.workflowAssignments.filter((wa) => !wa.workflow.isPublished);
    if (unpublished.length > 0) {
      throw new BadRequestException(
        `Workflows are not published: ${unpublished.map((w) => w.workflowId).join(', ')}`,
      );
    }

    const updated = await this.prisma.formCampaign.update({
      where: { id },
      data: { status: 'active' },
    });

    // Resolve and create assignments for this campaign (only on initial activation)
    if (campaign.status === 'draft') {
      await this.assignmentsService.resolveAndCreate(id);
    }

    return updated;
  }

  async pause(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status !== 'active') {
      throw new BadRequestException('Only active campaigns can be paused');
    }
    return this.prisma.formCampaign.update({ where: { id }, data: { status: 'paused' } });
  }

  async recall(id: string) {
    const campaign = await this.findOne(id);
    if (!['active', 'paused'].includes(campaign.status)) {
      throw new BadRequestException('Only active or paused campaigns can be recalled');
    }

    // Collect affected users before flagging
    const affected = await this.prisma.submissionsAssignment.findMany({
      where: { campaignId: id, status: { in: ['pending', 'in_progress'] } },
      select: { assignedTo: true },
    });
    const affectedUserIds = [...new Set(affected.map((a) => a.assignedTo))];

    // Mark all pending/in_progress assignments as flagged
    await this.prisma.submissionsAssignment.updateMany({
      where: { campaignId: id, status: { in: ['pending', 'in_progress'] } },
      data: { status: 'flagged' },
    });

    const recalled = await this.prisma.formCampaign.update({
      where: { id },
      data: { status: 'recalled' },
    });

    // Notify all affected users
    if (affectedUserIds.length > 0) {
      const campaignTitle = (campaign.title as Record<string, string>).en ?? 'Campaign';
      void this.notificationsService.notifyMany(affectedUserIds, {
        type: 'campaign_recalled',
        title: `Campaign recalled: ${campaignTitle}`,
        body: `The campaign "${campaignTitle}" has been recalled. No further action is required.`,
        entityType: 'campaign',
        entityId: id,
        sendEmail: true,
      });
    }

    return recalled;
  }

  async close(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'closed') {
      throw new BadRequestException('Campaign is already closed');
    }
    return this.prisma.formCampaign.update({ where: { id }, data: { status: 'closed' } });
  }

  // ── Workflow assignments ───────────────────────────────────────────────────

  async assignWorkflow(campaignId: string, dto: AssignWorkflowDto) {
    const campaign = await this.findOne(campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Workflow assignments can only be modified on draft campaigns');
    }

    const targetNode = await this.prisma.xeduNode.findUnique({ where: { id: dto.targetNodeId } });
    if (!targetNode) throw new NotFoundException(`Xedu node ${dto.targetNodeId} not found`);

    const workflow = await this.prisma.workflowDefinition.findUnique({ where: { id: dto.workflowId } });
    if (!workflow) throw new NotFoundException(`Workflow ${dto.workflowId} not found`);

    // One workflow per target node per campaign
    const existing = await this.prisma.campaignWorkflowAssignment.findFirst({
      where: { campaignId, targetNodeId: dto.targetNodeId },
    });
    if (existing) {
      throw new ConflictException(
        `Target node ${dto.targetNodeId} already has a workflow assigned in this campaign`,
      );
    }

    return this.prisma.campaignWorkflowAssignment.create({
      data: {
        campaignId,
        targetNodeId: dto.targetNodeId,
        workflowId: dto.workflowId,
        deadlineOverride: dto.deadlineOverride ? new Date(dto.deadlineOverride) : null,
      },
      include: {
        targetNode: { select: { id: true, code: true, name: true, nodeType: true } },
        workflow: { select: { id: true, name: true, isPublished: true } },
      },
    });
  }

  async removeWorkflowAssignment(campaignId: string, assignmentId: string) {
    const campaign = await this.findOne(campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Workflow assignments can only be modified on draft campaigns');
    }

    const wa = await this.prisma.campaignWorkflowAssignment.findFirst({
      where: { id: assignmentId, campaignId },
    });
    if (!wa) throw new NotFoundException(`Workflow assignment ${assignmentId} not found`);

    await this.prisma.campaignWorkflowAssignment.delete({ where: { id: assignmentId } });
  }
}
