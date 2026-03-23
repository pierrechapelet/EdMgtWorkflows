import { IsArray, IsUUID } from 'class-validator';

export class ReorderComponentsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
