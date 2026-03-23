import { IsString, IsUUID, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestUploadUrlDto {
  @IsUUID()
  assignmentId: string;

  @IsUUID()
  componentId: string;

  /** Original filename from the browser File object */
  @IsString()
  filename: string;

  /** MIME type e.g. application/pdf, image/jpeg */
  @IsString()
  contentType: string;

  /** File size in bytes for validation */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  sizeBytes?: number;
}
