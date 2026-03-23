import { IsOptional, IsUUID, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class WorkflowQueryDto {
  @IsOptional()
  @IsUUID()
  ownerNodeId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
