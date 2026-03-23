import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreatePermissionDto {
  @IsUUID()
  roleId: string;

  /** Null = applies to all Xedu nodes */
  @IsOptional()
  @IsUUID()
  xeduNodeId?: string;

  /** Null = applies to all form templates */
  @IsOptional()
  @IsUUID()
  formTemplateId?: string;

  /** Null = applies to all components within the template */
  @IsOptional()
  @IsUUID()
  componentId?: string;

  /** Null = applies to all workflow steps */
  @IsOptional()
  @IsUUID()
  workflowStepId?: string;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canWrite?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsBoolean()
  canReject?: boolean;

  @IsOptional()
  @IsBoolean()
  canForward?: boolean;

  /** Whether this permission propagates to child nodes via hierarchical edges */
  @IsOptional()
  @IsBoolean()
  inheritsToChildren?: boolean;
}
