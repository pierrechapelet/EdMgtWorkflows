import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { CreateFormVersionDto } from './dto/create-form-version.dto';

@Controller('forms/templates/:templateId/versions')
export class FormsVersionsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  async findAll(@Param('templateId', ParseUUIDPipe) templateId: string) {
    return { data: await this.formsService.findAllVersions(templateId) };
  }

  @Get(':versionId')
  async findOne(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return { data: await this.formsService.findOneVersion(templateId, versionId) };
  }

  @Post()
  async create(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateFormVersionDto,
  ) {
    return { data: await this.formsService.createVersion(templateId, dto) };
  }

  @Post(':versionId/publish')
  async publish(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return { data: await this.formsService.publishVersion(templateId, versionId) };
  }
}
