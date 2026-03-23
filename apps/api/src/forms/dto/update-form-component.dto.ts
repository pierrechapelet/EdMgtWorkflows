import { IsOptional, IsObject, IsBoolean, IsInt, Min, IsUUID } from 'class-validator';

export class UpdateFormComponentDto {
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @IsObject()
  @IsOptional()
  label?: Record<string, string>;

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
  isRequired?: boolean;
}
