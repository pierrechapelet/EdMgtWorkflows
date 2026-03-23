import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '@edmgt/shared-types';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * POST /api/v1/permissions
   * Create a new permission grant.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  /**
   * GET /api/v1/permissions
   * List permissions with optional filters.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Get()
  findAll(@Query() query: PermissionQueryDto) {
    return this.permissionsService.findAll(query);
  }

  /**
   * GET /api/v1/permissions/me
   * Returns the effective permission matrix for the current user.
   * Useful for building permission-aware UIs.
   */
  @Get('me')
  getMyPermissions(@CurrentUser() user: RequestUser) {
    return this.permissionsService.getEffectivePermissions(user.id);
  }

  /**
   * POST /api/v1/permissions/check
   * Check if the current user has a specific permission.
   * Returns { granted: boolean }
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckPermissionDto,
  ) {
    const granted = await this.permissionsService.check({
      userId: user.id,
      action: dto.action,
      componentId: dto.componentId,
      workflowStepId: dto.workflowStepId,
      formTemplateId: dto.formTemplateId,
    });
    return { granted };
  }

  /**
   * GET /api/v1/permissions/:id
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  /**
   * PATCH /api/v1/permissions/:id
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  /**
   * DELETE /api/v1/permissions/:id
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
