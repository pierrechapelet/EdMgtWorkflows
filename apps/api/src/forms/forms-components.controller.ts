import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { CreateFormComponentDto } from './dto/create-form-component.dto';
import { UpdateFormComponentDto } from './dto/update-form-component.dto';
import { ReorderComponentsDto } from './dto/reorder-components.dto';

@Controller('forms/templates/:templateId/versions/:versionId/components')
export class FormsComponentsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  async findAll(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    const version = await this.formsService.findOneVersion(templateId, versionId);
    return { data: version.components };
  }

  @Post()
  async create(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: CreateFormComponentDto,
  ) {
    return { data: await this.formsService.createComponent(templateId, versionId, dto) };
  }

  @Patch(':componentId')
  async update(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: UpdateFormComponentDto,
  ) {
    return {
      data: await this.formsService.updateComponent(templateId, versionId, componentId, dto),
    };
  }

  @Delete(':componentId')
  async remove(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
  ) {
    await this.formsService.deleteComponent(templateId, versionId, componentId);
    return { data: null };
  }

  @Put('reorder')
  async reorder(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReorderComponentsDto,
  ) {
    return {
      data: await this.formsService.reorderComponents(templateId, versionId, dto),
    };
  }
}
