import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID } from 'class-validator';

export class CreateFormTemplateDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsObject()
  title: Record<string, string>;

  @IsUUID()
  ownerNodeId: string;

  @IsUUID()
  @IsOptional()
  currentVersionId?: string;
}
