import { IsArray, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionValueDto } from './save-draft.dto';

export class SubmitSubmissionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionValueDto)
  values: SubmissionValueDto[];

  /**
   * Base64-encoded PNG of the signature image (drawn mode).
   * Required when the form has a signature component.
   */
  @IsString()
  @IsOptional()
  signatureImageBase64?: string;

  /** Typed name alternative to drawn signature */
  @IsString()
  @IsOptional()
  signatureTypedName?: string;
}
