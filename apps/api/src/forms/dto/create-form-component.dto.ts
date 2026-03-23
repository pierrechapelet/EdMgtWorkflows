import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ComponentType } from '@edmgt/shared-types';

export class CreateFormComponentDto {
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(0)
  orderIndex: number;

  @IsEnum(ComponentType)
  componentType: ComponentType;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsObject()
  label: Record<string, string>;

  @IsObject()
  @IsOptional()
  placeholder?: Record<string, string>;

  @IsObject()
  @IsOptional()
  helpText?: Record<string, string>;

  @IsObject()
  @IsOptional()
  validation?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  options?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  tableSchema?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  conditions?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;
}
