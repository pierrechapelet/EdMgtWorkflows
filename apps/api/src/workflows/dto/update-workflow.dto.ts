import { IsObject, IsOptional } from 'class-validator';

export class UpdateWorkflowDto {
  @IsObject()
  @IsOptional()
  name?: Record<string, string>;
}
