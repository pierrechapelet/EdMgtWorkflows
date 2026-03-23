import { IsOptional, IsBoolean } from 'class-validator';

export class CreateFormVersionDto {
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean = true;
}
