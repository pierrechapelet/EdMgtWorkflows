import { IsUUID, IsOptional, IsArray, ValidateNested, IsString, IsNumber, IsDateString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmissionValueDto {
  @IsUUID()
  componentId: string;

  @IsString()
  @IsOptional()
  valueText?: string;

  @IsNumber()
  @IsOptional()
  valueNumber?: number;

  @IsDateString()
  @IsOptional()
  valueDate?: string;

  /** Covers multi_select arrays, table rows, signature payload, geo JSON */
  @IsObject()
  @IsOptional()
  valueJson?: Record<string, unknown>;

  /** S3 object key for file_upload components */
  @IsString()
  @IsOptional()
  valueFileKey?: string;
}

export class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionValueDto)
  values: SubmissionValueDto[];

  /** True when called from the offline sync endpoint */
  @IsOptional()
  offlineFlag?: boolean;
}
