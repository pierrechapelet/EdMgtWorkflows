import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MultilingualStringDto } from '../../common/dto/multilingual.dto';

export class UpdateXeduNodeDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MultilingualStringDto)
  name?: MultilingualStringDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
