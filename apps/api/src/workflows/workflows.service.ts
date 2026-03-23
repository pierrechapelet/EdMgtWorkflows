import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { UpdateWorkflowStepDto } from './dto/update-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: DatabaseService) {}

  // ── Definitions ────────────────────────────────────────────────────────────

  async findAll(query: WorkflowQueryDto) {
    const { ownerNodeId, isPublished, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkflowDefinitionWhereInput = {
      ...(ownerNodeId && { ownerNodeId }),
      ...(isPublished !== undefined && { isPublished }),
    };

    const [data, total] = await Promise.all([
      this.prisma.workflowDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
          createdBy: { select: { id: true, email: true } },
          _count: { select: { steps: true } },
        },
      }),
      this.prisma.workflowDefinition.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        createdBy: { select: { id: true, email: true } },
        steps: {
          orderBy: { orderIndex: 'asc' },
          include: {
            assigneeRole: { select: { id: true, code: true, name: true } },
            escalationRole: { select: { id: true, code: true, name: true } },
            escalationStep: { select: { id: true, name: true, stepType: true } },
            outgoingTransitions: {
              include: {
                toStep: { select: { id: true, name: true, stepType: true } },
              },
            },
          },
        },
        transitions: {
          include: {
            fromStep: { select: { id: true, name: true, stepType: true } },
            toStep: { select: { id: true, name: true, stepType: true } },
          },
        },
      },
    });

    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    return workflow;
  }

  async create(dto: CreateWorkflowDto, createdById: string) {
    const ownerNode = await this.prisma.xeduNode.findUnique({ where: { id: dto.ownerNodeId } });
    if (!ownerNode) throw new NotFoundException(`Xedu node ${dto.ownerNodeId} not found`);

    return this.prisma.workflowDefinition.create({
      data: {
        name: dto.name,
        ownerNodeId: dto.ownerNodeId,
        createdById,
        isPublished: false,
      },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    await this.findOne(id);
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name }) },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
      },
    });
  }

  async publish(id: string) {
    const workflow = await this.findOne(id);

    if (workflow.isPublished) {
      throw new BadRequestException('Workflow is already published');
    }

    // Validation: must have at least one step and a terminal (end) step
    const steps = workflow.steps;
    if (steps.length === 0) {
      throw new BadRequestException('Cannot publish a workflow with no steps');
    }
    const hasEndStep = steps.some((s) => s.stepType === 'end');
    if (!hasEndStep) {
      throw new BadRequestException('Workflow must have an "end" step before publishing');
    }

    return this.prisma.workflowDefinition.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  async createStep(workflowId: string, dto: CreateWorkflowStepDto) {
    const workflow = await this.findOne(workflowId);
    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify a published workflow');
    }

    if (dto.assigneeRoleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.assigneeRoleId } });
      if (!role) throw new NotFoundException(`Role ${dto.assigneeRoleId} not found`);
    }

    if (dto.escalationStepId) {
      const escStep = await this.prisma.workflowStep.findFirst({
        where: { id: dto.escalationStepId, workflowId },
      });
      if (!escStep) {
        throw new NotFoundException(`Escalation step ${dto.escalationStepId} not found in this workflow`);
      }
    }

    return this.prisma.workflowStep.create({
      data: {
        workflowId,
        name: dto.name,
        stepType: dto.stepType,
        orderIndex: dto.orderIndex,
        assigneeRoleId: dto.assigneeRoleId ?? null,
        assigneeNodeId: dto.assigneeNodeId ?? null,
        assigneeNodeRel: dto.assigneeNodeRel ?? null,
        deadlineOffsetHours: dto.deadlineOffsetHours ?? null,
        escalationStepId: dto.escalationStepId ?? null,
        escalationRoleId: dto.escalationRoleId ?? null,
        escalationNodeRel: dto.escalationNodeRel ?? null,
        escalationNodeId: dto.escalationNodeId ?? null,
      },
      include: {
        assigneeRole: { select: { id: true, code: true, name: true } },
        escalationRole: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateStep(workflowId: string, stepId: string, dto: UpdateWorkflowStepDto) {
    const workflow = await this.findOne(workflowId);
    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify a published workflow');
    }

    const step = await this.prisma.workflowStep.findFirst({ where: { id: stepId, workflowId } });
    if (!step) throw new NotFoundException(`Step ${stepId} not found`);

    if (dto.escalationStepId && dto.escalationStepId === stepId) {
      throw new BadRequestException('A step cannot escalate to itself');
    }

    return this.prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.assigneeRoleId !== undefined && { assigneeRoleId: dto.assigneeRoleId }),
        ...(dto.assigneeNodeId !== undefined && { assigneeNodeId: dto.assigneeNodeId }),
        ...(dto.assigneeNodeRel !== undefined && { assigneeNodeRel: dto.assigneeNodeRel }),
        ...(dto.deadlineOffsetHours !== undefined && { deadlineOffsetHours: dto.deadlineOffsetHours }),
        ...(dto.escalationStepId !== undefined && { escalationStepId: dto.escalationStepId }),
        ...(dto.escalationRoleId !== undefined && { escalationRoleId: dto.escalationRoleId }),
        ...(dto.escalationNodeRel !== undefined && { escalationNodeRel: dto.escalationNodeRel }),
        ...(dto.escalationNodeId !== undefined && { escalationNodeId: dto.escalationNodeId }),
      },
      include: {
        assigneeRole: { select: { id: true, code: true, name: true } },
        escalationRole: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteStep(workflowId: string, stepId: string) {
    const workflow = await this.findOne(workflowId);
    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify a published workflow');
    }

    const step = await this.prisma.workflowStep.findFirst({ where: { id: stepId, workflowId } });
    if (!step) throw new NotFoundException(`Step ${stepId} not found`);

    // Remove transitions that reference this step
    await this.prisma.workflowTransition.deleteMany({
      where: { OR: [{ fromStepId: stepId }, { toStepId: stepId }] },
    });

    // Clear escalationStepId references
    await this.prisma.workflowStep.updateMany({
      where: { escalationStepId: stepId },
      data: { escalationStepId: null },
    });

    await this.prisma.workflowStep.delete({ where: { id: stepId } });
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  async createTransition(workflowId: string, dto: CreateWorkflowTransitionDto) {
    const workflow = await this.findOne(workflowId);
    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify a published workflow');
    }

    if (dto.fromStepId === dto.toStepId) {
      throw new BadRequestException('A transition cannot point to the same step');
    }

    // Verify both steps belong to this workflow
    const [fromStep, toStep] = await Promise.all([
      this.prisma.workflowStep.findFirst({ where: { id: dto.fromStepId, workflowId } }),
      this.prisma.workflowStep.findFirst({ where: { id: dto.toStepId, workflowId } }),
    ]);
    if (!fromStep) throw new NotFoundException(`Step ${dto.fromStepId} not found in this workflow`);
    if (!toStep) throw new NotFoundException(`Step ${dto.toStepId} not found in this workflow`);

    // Prevent duplicate from+trigger combination
    const duplicate = await this.prisma.workflowTransition.findFirst({
      where: { fromStepId: dto.fromStepId, triggerAction: dto.triggerAction },
    });
    if (duplicate) {
      throw new ConflictException(
        `A transition for action "${dto.triggerAction}" already exists from this step`,
      );
    }

    return this.prisma.workflowTransition.create({
      data: {
        fromStepId: dto.fromStepId,
        toStepId: dto.toStepId,
        triggerAction: dto.triggerAction,
        conditions: dto.conditions ?? Prisma.JsonNull,
      },
      include: {
        fromStep: { select: { id: true, name: true, stepType: true } },
        toStep: { select: { id: true, name: true, stepType: true } },
      },
    });
  }

  async deleteTransition(workflowId: string, transitionId: string) {
    const workflow = await this.findOne(workflowId);
    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify a published workflow');
    }

    const transition = await this.prisma.workflowTransition.findFirst({
      where: {
        id: transitionId,
        fromStep: { workflowId },
      },
    });
    if (!transition) throw new NotFoundException(`Transition ${transitionId} not found`);

    await this.prisma.workflowTransition.delete({ where: { id: transitionId } });
  }

  // ── Graph export (for React Flow) ──────────────────────────────────────────

  async getGraph(workflowId: string) {
    const workflow = await this.findOne(workflowId);

    const nodes = workflow.steps.map((step, i) => ({
      id: step.id,
      type: 'workflowStep',
      position: { x: 250, y: i * 140 }, // default linear layout; overridden by frontend positions
      data: {
        stepId: step.id,
        name: step.name,
        stepType: step.stepType,
        assigneeRole: step.assigneeRole,
        assigneeNodeRel: step.assigneeNodeRel,
        deadlineOffsetHours: step.deadlineOffsetHours,
        escalationStep: step.escalationStep,
        orderIndex: step.orderIndex,
      },
    }));

    const edges = workflow.transitions.map((t) => ({
      id: t.id,
      source: t.fromStepId,
      target: t.toStepId,
      label: t.triggerAction,
      type: 'smoothstep',
      data: {
        transitionId: t.id,
        triggerAction: t.triggerAction,
        conditions: t.conditions,
      },
    }));

    return { nodes, edges, workflow };
  }
}
