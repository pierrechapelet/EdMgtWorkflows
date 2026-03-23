import { IsObject, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateCampaignDto {
  @IsObject()
  title: Record<string, string>;

  @IsUUID()
  formTemplateId: string;

  @IsUUID()
  ownerNodeId: string;

  @IsDateString()
  @IsOptional()
  globalDeadline?: string;
}
