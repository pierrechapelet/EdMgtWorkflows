import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class UpdateFormTemplateDto {
  @IsObject()
  @IsOptional()
  title?: Record<string, string>;

  @IsUUID()
  @IsOptional()
  currentVersionId?: string;
}
