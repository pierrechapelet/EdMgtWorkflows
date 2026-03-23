import {
  IsObject,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { NodeRelType } from '@edmgt/shared-types';

export class UpdateWorkflowStepDto {
  @IsObject()
  @IsOptional()
  name?: Record<string, string>;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @IsUUID()
  @IsOptional()
  assigneeRoleId?: string;

  @IsUUID()
  @IsOptional()
  assigneeNodeId?: string;

  @IsEnum(NodeRelType)
  @IsOptional()
  assigneeNodeRel?: NodeRelType;

  @IsNumber()
  @IsOptional()
  deadlineOffsetHours?: number;

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
