import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PermissionAction } from '@edmgt/shared-types';

export class CheckPermissionDto {
  @IsEnum(PermissionAction)
  action: PermissionAction;

  /** If provided, checks permission for a specific form component */
  @IsOptional()
  @IsUUID()
  componentId?: string;

  /** If provided, checks permission at a specific workflow step */
  @IsOptional()
  @IsUUID()
  workflowStepId?: string;

  /** If provided, checks permission for a specific form template */
  @IsOptional()
  @IsUUID()
  formTemplateId?: string;
}
