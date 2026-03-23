import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionRequirement } from './decorators/require-permission.decorator';
import { PermissionsService } from './permissions.service';
import { RequestUser } from '@edmgt/shared-types';
import { AppException } from '../common/exceptions/app.exception';

/**
 * Enforces the full graph-aware permission model.
 *
 * Reads @RequirePermission() metadata, extracts context IDs from route params,
 * and calls PermissionsService.check() which evaluates:
 *   role × xedu_node (+ ancestors) × component × workflow_step × action
 *
 * Must be applied after JwtAuthGuard.
 * Routes without @RequirePermission() are passed through.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      throw new AppException('UNAUTHORIZED', 'Authentication required', 401);
    }

    const params = request.params ?? {};

    const granted = await this.permissionsService.check({
      userId: user.id,
      action: requirement.action,
      formTemplateId: requirement.formTemplateParam
        ? params[requirement.formTemplateParam]
        : undefined,
      componentId: requirement.componentParam
        ? params[requirement.componentParam]
        : undefined,
      workflowStepId: requirement.workflowStepParam
        ? params[requirement.workflowStepParam]
        : undefined,
    });

    if (!granted) {
      throw new AppException(
        'PERMISSION_DENIED',
        `You do not have '${requirement.action}' permission for this resource`,
        403,
      );
    }

    return true;
  }
}
