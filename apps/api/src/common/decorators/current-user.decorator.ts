import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '@edmgt/shared-types';

/**
 * Extracts the authenticated user from the request object.
 * Populated by JwtStrategy.validate() after token verification.
 *
 * Usage: @CurrentUser() user: RequestUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
