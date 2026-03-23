import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for multilingual string fields (name, title, label, etc.)
 * At least one language must be provided — enforced at the service layer.
 */
export class MultilingualStringDto {
  @IsOptional()
  @IsString()
  en?: string;

  @IsOptional()
  @IsString()
  ar?: string;

  @IsOptional()
  @IsString()
  fr?: string;

  @IsOptional()
  @IsString()
  es?: string;
}
