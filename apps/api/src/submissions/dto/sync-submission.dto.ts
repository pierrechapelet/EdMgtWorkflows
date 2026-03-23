import { IsUUID, IsArray, ValidateNested, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionValueDto } from './save-draft.dto';

export class SyncSubmissionDto {
  /** The assignment this submission belongs to */
  @IsUUID()
  assignmentId: string;

  /** Client-generated device ID for deduplication */
  @IsString()
  deviceId: string;

  /** ISO timestamp the device created/last modified this draft */
  @IsDateString()
  clientTimestamp: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionValueDto)
  values: SubmissionValueDto[];

  @IsString()
  @IsOptional()
  signatureImageBase64?: string;

  @IsString()
  @IsOptional()
  signatureTypedName?: string;

  /** True if device intends to submit (not just save draft) */
  @IsOptional()
  submit?: boolean;
}

export class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSubmissionDto)
  submissions: SyncSubmissionDto[];
}
