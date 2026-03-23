import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '@edmgt/shared-types';
import { AppException } from '../exceptions/app.exception';

/**
 * Guards routes decorated with @Roles().
 * Passes if the authenticated user holds any of the required role codes
 * in at least one active Xedu node assignment.
 *
 * Must be used after JwtAuthGuard (i.e., request.user must be populated).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — allow any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new AppException('UNAUTHORIZED', 'Authentication required', 401);
    }

    const hasRole = user.roleAssignments.some((assignment) =>
      requiredRoles.includes(assignment.role.code),
    );

    if (!hasRole) {
      throw new AppException(
        'FORBIDDEN',
        `One of these roles is required: ${requiredRoles.join(', ')}`,
        403,
      );
    }

    return true;
  }
}
