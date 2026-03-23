import { IsObject, IsOptional, IsDateString } from 'class-validator';

export class UpdateCampaignDto {
  @IsObject()
  @IsOptional()
  title?: Record<string, string>;

  @IsDateString()
  @IsOptional()
  globalDeadline?: string;
}
