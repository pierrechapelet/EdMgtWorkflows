import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MultilingualStringDto } from '../../common/dto/multilingual.dto';

export class UpdateRoleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MultilingualStringDto)
  name?: MultilingualStringDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MultilingualStringDto)
  description?: MultilingualStringDto;
}
