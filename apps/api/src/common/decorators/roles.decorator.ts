import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to users who hold at least one of the given role codes
 * at any active Xedu node assignment.
 *
 * Usage: @Roles('super_admin') or @Roles('super_admin', 'district_officer')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
