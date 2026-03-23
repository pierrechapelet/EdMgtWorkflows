import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
