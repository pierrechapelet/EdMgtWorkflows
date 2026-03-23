import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '@edmgt/shared-types';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users
   * List all active users. Restricted to admin roles.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  /**
   * GET /api/v1/users/me
   * Full profile of the currently authenticated user.
   */
  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.findById(user.id);
  }

  /**
   * GET /api/v1/users/:id
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // ─── Role assignments ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/users/:id/roles
   * Get all active role assignments for a user.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Get(':id/roles')
  getRoles(@Param('id') id: string) {
    return this.usersService.getRoleAssignments(id);
  }

  /**
   * POST /api/v1/users/:id/roles
   * Assign a role at a specific Xedu node to a user.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.usersService.assignRole(id, dto, currentUser.id);
  }

  /**
   * DELETE /api/v1/users/:id/roles/:assignmentId
   * Revoke a role assignment (sets validUntil = now).
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Delete(':id/roles/:assignmentId')
  @HttpCode(HttpStatus.OK)
  revokeRole(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.usersService.revokeRoleAssignment(id, assignmentId);
  }
}
