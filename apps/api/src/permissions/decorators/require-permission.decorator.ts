import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '@edmgt/shared-types';

export const PERMISSION_KEY = 'permission';

export interface PermissionRequirement {
  action: PermissionAction;
  /** Route param name containing the formTemplateId, if applicable */
  formTemplateParam?: string;
  /** Route param name containing the componentId, if applicable */
  componentParam?: string;
  /** Route param name containing the workflowStepId, if applicable */
  workflowStepParam?: string;
}

/**
 * Declares the permission required to access a route.
 * Used together with PermissionsGuard.
 *
 * Usage:
 *   @RequirePermission({ action: PermissionAction.READ })
 *   @RequirePermission({ action: PermissionAction.APPROVE, formTemplateParam: 'templateId' })
 */
export const RequirePermission = (requirement: PermissionRequirement) =>
  SetMetadata(PERMISSION_KEY, requirement);
