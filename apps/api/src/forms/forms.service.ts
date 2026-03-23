import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateFormTemplateDto } from './dto/create-form-template.dto';
import { UpdateFormTemplateDto } from './dto/update-form-template.dto';
import { FormTemplateQueryDto } from './dto/form-query.dto';
import { CreateFormVersionDto } from './dto/create-form-version.dto';
import { CreateFormComponentDto } from './dto/create-form-component.dto';
import { UpdateFormComponentDto } from './dto/update-form-component.dto';
import { ReorderComponentsDto } from './dto/reorder-components.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FormsService {
  constructor(private readonly prisma: DatabaseService) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async findAllTemplates(query: FormTemplateQueryDto) {
    const { ownerNodeId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FormTemplateWhereInput = {
      ...(ownerNodeId && { ownerNodeId }),
      ...(search && {
        title: { path: ['en'], string_contains: search },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.formTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
          currentVersion: { select: { id: true, versionNumber: true, isPublished: true } },
          _count: { select: { versions: true } },
        },
      }),
      this.prisma.formTemplate.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        currentVersion: {
          include: {
            components: { orderBy: [{ parentId: 'asc' }, { orderIndex: 'asc' }] },
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            isPublished: true,
            isDraft: true,
            publishedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!template) throw new NotFoundException(`Form template ${id} not found`);
    return template;
  }

  async createTemplate(dto: CreateFormTemplateDto) {
    const existing = await this.prisma.formTemplate.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Template with code "${dto.code}" already exists`);

    const ownerNode = await this.prisma.xeduNode.findUnique({ where: { id: dto.ownerNodeId } });
    if (!ownerNode) throw new NotFoundException(`Xedu node ${dto.ownerNodeId} not found`);

    return this.prisma.formTemplate.create({
      data: { code: dto.code, title: dto.title, ownerNodeId: dto.ownerNodeId },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateFormTemplateDto) {
    await this.findOneTemplate(id);

    if (dto.currentVersionId) {
      const version = await this.prisma.formVersion.findUnique({
        where: { id: dto.currentVersionId },
      });
      if (!version || version.templateId !== id) {
        throw new BadRequestException('Version does not belong to this template');
      }
      if (!version.isPublished) {
        throw new BadRequestException('Cannot set an unpublished version as current');
      }
    }

    return this.prisma.formTemplate.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.currentVersionId && { currentVersionId: dto.currentVersionId }),
      },
      include: {
        ownerNode: { select: { id: true, code: true, name: true, nodeType: true } },
        currentVersion: { select: { id: true, versionNumber: true, isPublished: true } },
      },
    });
  }

  // ── Versions ───────────────────────────────────────────────────────────────

  async findAllVersions(templateId: string) {
    await this.findOneTemplate(templateId);
    return this.prisma.formVersion.findMany({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
      include: {
        _count: { select: { components: true } },
      },
    });
  }

  async findOneVersion(templateId: string, versionId: string) {
    const version = await this.prisma.formVersion.findFirst({
      where: { id: versionId, templateId },
      include: {
        components: { orderBy: [{ parentId: 'asc' }, { orderIndex: 'asc' }] },
      },
    });
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);
    return version;
  }

  async createVersion(templateId: string, _dto: CreateFormVersionDto) {
    await this.findOneTemplate(templateId);

    const lastVersion = await this.prisma.formVersion.findFirst({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    // If there's a previous version, copy its components into the new draft
    const newVersion = await this.prisma.formVersion.create({
      data: {
        templateId,
        versionNumber: newVersionNumber,
        schema: {},
        isDraft: true,
        isPublished: false,
      },
    });

    if (lastVersion) {
      const sourceComponents = await this.prisma.formComponent.findMany({
        where: { versionId: lastVersion.id },
        orderBy: [{ parentId: 'asc' }, { orderIndex: 'asc' }],
      });

      // Build ID map for re-linking parent references
      const idMap = new Map<string, string>();

      // First pass: create all components, map old IDs → new IDs
      for (const comp of sourceComponents) {
        const created = await this.prisma.formComponent.create({
          data: {
            versionId: newVersion.id,
            parentId: null, // Fix up in second pass
            orderIndex: comp.orderIndex,
            componentType: comp.componentType,
            key: comp.key,
            label: comp.label as Prisma.InputJsonValue,
            placeholder: comp.placeholder as Prisma.InputJsonValue,
            helpText: comp.helpText as Prisma.InputJsonValue,
            validation: comp.validation as Prisma.InputJsonValue,
            options: comp.options as Prisma.InputJsonValue,
            tableSchema: comp.tableSchema as Prisma.InputJsonValue,
            conditions: comp.conditions as Prisma.InputJsonValue,
            isRequired: comp.isRequired,
          },
        });
        idMap.set(comp.id, created.id);
      }

      // Second pass: fix parentId references
      for (const comp of sourceComponents) {
        if (comp.parentId) {
          const newId = idMap.get(comp.id);
          const newParentId = idMap.get(comp.parentId);
          if (newId && newParentId) {
            await this.prisma.formComponent.update({
              where: { id: newId },
              data: { parentId: newParentId },
            });
          }
        }
      }
    }

    // Regenerate schema snapshot
    await this.regenerateSchema(newVersion.id);
    return this.findOneVersion(templateId, newVersion.id);
  }

  async publishVersion(templateId: string, versionId: string) {
    const version = await this.findOneVersion(templateId, versionId);
    if (version.isPublished) throw new BadRequestException('Version is already published');

    const published = await this.prisma.formVersion.update({
      where: { id: versionId },
      data: { isPublished: true, isDraft: false, publishedAt: new Date() },
    });

    // Automatically set as current version
    await this.prisma.formTemplate.update({
      where: { id: templateId },
      data: { currentVersionId: versionId },
    });

    return published;
  }

  // ── Components ─────────────────────────────────────────────────────────────

  async createComponent(templateId: string, versionId: string, dto: CreateFormComponentDto) {
    const version = await this.findOneVersion(templateId, versionId);
    if (!version.isDraft) throw new BadRequestException('Cannot modify a published version');

    if (dto.parentId) {
      const parent = await this.prisma.formComponent.findFirst({
        where: { id: dto.parentId, versionId },
      });
      if (!parent) throw new NotFoundException(`Parent component ${dto.parentId} not found`);
    }

    const component = await this.prisma.formComponent.create({
      data: {
        versionId,
        parentId: dto.parentId ?? null,
        orderIndex: dto.orderIndex,
        componentType: dto.componentType,
        key: dto.key,
        label: dto.label,
        placeholder: dto.placeholder ?? Prisma.JsonNull,
        helpText: dto.helpText ?? Prisma.JsonNull,
        validation: dto.validation ?? Prisma.JsonNull,
        options: dto.options ?? Prisma.JsonNull,
        tableSchema: dto.tableSchema ?? Prisma.JsonNull,
        conditions: dto.conditions ?? Prisma.JsonNull,
        isRequired: dto.isRequired ?? false,
      },
    });

    await this.regenerateSchema(versionId);
    return component;
  }

  async updateComponent(
    templateId: string,
    versionId: string,
    componentId: string,
    dto: UpdateFormComponentDto,
  ) {
    const version = await this.findOneVersion(templateId, versionId);
    if (!version.isDraft) throw new BadRequestException('Cannot modify a published version');

    const component = await this.prisma.formComponent.findFirst({
      where: { id: componentId, versionId },
    });
    if (!component) throw new NotFoundException(`Component ${componentId} not found`);

    const updated = await this.prisma.formComponent.update({
      where: { id: componentId },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.label && { label: dto.label }),
        ...(dto.placeholder !== undefined && { placeholder: dto.placeholder ?? Prisma.JsonNull }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText ?? Prisma.JsonNull }),
        ...(dto.validation !== undefined && { validation: dto.validation ?? Prisma.JsonNull }),
        ...(dto.options !== undefined && { options: dto.options ?? Prisma.JsonNull }),
        ...(dto.tableSchema !== undefined && { tableSchema: dto.tableSchema ?? Prisma.JsonNull }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions ?? Prisma.JsonNull }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
      },
    });

    await this.regenerateSchema(versionId);
    return updated;
  }

  async deleteComponent(templateId: string, versionId: string, componentId: string) {
    const version = await this.findOneVersion(templateId, versionId);
    if (!version.isDraft) throw new BadRequestException('Cannot modify a published version');

    const component = await this.prisma.formComponent.findFirst({
      where: { id: componentId, versionId },
    });
    if (!component) throw new NotFoundException(`Component ${componentId} not found`);

    // Cascade delete children
    await this.deleteComponentTree(componentId);
    await this.regenerateSchema(versionId);
  }

  private async deleteComponentTree(componentId: string) {
    const children = await this.prisma.formComponent.findMany({
      where: { parentId: componentId },
      select: { id: true },
    });
    for (const child of children) {
      await this.deleteComponentTree(child.id);
    }
    await this.prisma.formComponent.delete({ where: { id: componentId } });
  }

  async reorderComponents(
    templateId: string,
    versionId: string,
    dto: ReorderComponentsDto,
  ) {
    const version = await this.findOneVersion(templateId, versionId);
    if (!version.isDraft) throw new BadRequestException('Cannot modify a published version');

    await Promise.all(
      dto.orderedIds.map((id, index) =>
        this.prisma.formComponent.updateMany({
          where: { id, versionId },
          data: { orderIndex: index },
        }),
      ),
    );

    await this.regenerateSchema(versionId);
    return this.findOneVersion(templateId, versionId);
  }

  // ── Schema Snapshot ────────────────────────────────────────────────────────

  /**
   * Regenerates the JSONB schema snapshot stored on the form_version row.
   * The snapshot mirrors the component tree in a portable format that can be
   * evaluated offline without a DB connection.
   */
  private async regenerateSchema(versionId: string) {
    const components = await this.prisma.formComponent.findMany({
      where: { versionId },
      orderBy: [{ parentId: 'asc' }, { orderIndex: 'asc' }],
    });

    const schema = this.buildComponentTree(components, null);

    await this.prisma.formVersion.update({
      where: { id: versionId },
      data: { schema },
    });
  }

  private buildComponentTree(
    all: Array<{
      id: string;
      parentId: string | null;
      orderIndex: number;
      componentType: string;
      key: string;
      label: unknown;
      placeholder: unknown;
      helpText: unknown;
      validation: unknown;
      options: unknown;
      tableSchema: unknown;
      conditions: unknown;
      isRequired: boolean;
    }>,
    parentId: string | null,
  ): unknown[] {
    return all
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => ({
        id: c.id,
        key: c.key,
        type: c.componentType,
        label: c.label,
        placeholder: c.placeholder,
        helpText: c.helpText,
        validation: c.validation,
        options: c.options,
        tableSchema: c.tableSchema,
        conditions: c.conditions,
        isRequired: c.isRequired,
        children: this.buildComponentTree(all, c.id),
      }));
  }
}
