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
import { XeduService } from './xedu.service';
import { CreateXeduNodeDto } from './dto/create-xedu-node.dto';
import { UpdateXeduNodeDto } from './dto/update-xedu-node.dto';
import { XeduNodeQueryDto } from './dto/xedu-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('xedu/nodes')
@UseGuards(JwtAuthGuard)
export class XeduNodesController {
  constructor(private readonly xeduService: XeduService) {}

  /**
   * POST /api/v1/xedu/nodes
   * Create a new organizational node.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateXeduNodeDto) {
    return this.xeduService.createNode(dto);
  }

  /**
   * GET /api/v1/xedu/nodes
   * List nodes with optional filters and pagination.
   */
  @Get()
  findAll(@Query() query: XeduNodeQueryDto) {
    return this.xeduService.findNodes(query);
  }

  /**
   * GET /api/v1/xedu/nodes/:id
   * Get a single node with its edges.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.xeduService.findNode(id);
  }

  /**
   * PATCH /api/v1/xedu/nodes/:id
   * Update node name, metadata, or active status.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateXeduNodeDto) {
    return this.xeduService.updateNode(id, dto);
  }

  /**
   * DELETE /api/v1/xedu/nodes/:id
   * Soft-delete (deactivate) a node.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.xeduService.deactivateNode(id);
  }

  /**
   * GET /api/v1/xedu/nodes/:id/ancestors
   * Get all ancestor nodes via closure table (hierarchical edges only).
   */
  @Get(':id/ancestors')
  getAncestors(@Param('id') id: string) {
    return this.xeduService.getAncestors(id);
  }

  /**
   * GET /api/v1/xedu/nodes/:id/descendants
   * Get all descendant nodes via closure table (hierarchical edges only).
   */
  @Get(':id/descendants')
  getDescendants(@Param('id') id: string) {
    return this.xeduService.getDescendants(id);
  }

  /**
   * GET /api/v1/xedu/nodes/:id/subtree
   * Get the node plus all descendants as a flat list with depth.
   */
  @Get(':id/subtree')
  getSubtree(@Param('id') id: string) {
    return this.xeduService.getSubtree(id);
  }
}
