import {
  IsObject,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { StepType, NodeRelType } from '@edmgt/shared-types';

export class CreateWorkflowStepDto {
  @IsObject()
  name: Record<string, string>;

  @IsEnum(StepType)
  stepType: StepType;

  @IsInt()
  @Min(0)
  orderIndex: number;

  /** Role that owns this step (null = any role) */
  @IsUUID()
  @IsOptional()
  assigneeRoleId?: string;

  /** Concrete node override (used when nodeRel = 'absolute') */
  @IsUUID()
  @IsOptional()
  assigneeNodeId?: string;

  /** How the assignee node is resolved relative to the submitter's node */
  @IsEnum(NodeRelType)
  @IsOptional()
  assigneeNodeRel?: NodeRelType;

  /** Hours until deadline from step assignment */
  @IsNumber()
  @IsOptional()
  deadlineOffsetHours?: number;

  /** Step to escalate to when deadline passes */
  @IsUUID()
  @IsOptional()
  escalationStepId?: string;

  @IsUUID()
  @IsOptional()
  escalationRoleId?: string;

  @IsEnum(NodeRelType)
  @IsOptional()
  escalationNodeRel?: NodeRelType;

  @IsUUID()
  @IsOptional()
  escalationNodeId?: string;
}
