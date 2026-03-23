import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class AssignWorkflowDto {
  @IsUUID()
  targetNodeId: string;

  @IsUUID()
  workflowId: string;

  @IsDateString()
  @IsOptional()
  deadlineOverride?: string;
}
