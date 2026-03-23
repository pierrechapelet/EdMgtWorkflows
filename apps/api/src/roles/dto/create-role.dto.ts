import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MultilingualStringDto } from '../../common/dto/multilingual.dto';

export class CreateRoleDto {
  @ValidateNested()
  @Type(() => MultilingualStringDto)
  name: MultilingualStringDto;

  @ValidateNested()
  @Type(() => MultilingualStringDto)
  description: MultilingualStringDto;
}
