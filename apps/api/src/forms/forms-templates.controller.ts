import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { CreateFormTemplateDto } from './dto/create-form-template.dto';
import { UpdateFormTemplateDto } from './dto/update-form-template.dto';
import { FormTemplateQueryDto } from './dto/form-query.dto';

@Controller('forms/templates')
export class FormsTemplatesController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  async findAll(@Query() query: FormTemplateQueryDto) {
    return this.formsService.findAllTemplates(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.formsService.findOneTemplate(id) };
  }

  @Post()
  async create(@Body() dto: CreateFormTemplateDto) {
    return { data: await this.formsService.createTemplate(dto) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormTemplateDto,
  ) {
    return { data: await this.formsService.updateTemplate(id, dto) };
  }
}
