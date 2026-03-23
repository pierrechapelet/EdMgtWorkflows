import { IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType } from '@prisma/client';
import { MultilingualStringDto } from '../../common/dto/multilingual.dto';

export class CreateXeduNodeDto {
  @IsEnum(NodeType)
  nodeType: NodeType;

  @ValidateNested()
  @Type(() => MultilingualStringDto)
  name: MultilingualStringDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
