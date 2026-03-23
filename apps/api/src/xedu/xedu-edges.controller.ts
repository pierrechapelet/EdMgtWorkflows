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
import { XeduService } from './xedu.service';
import { CreateXeduEdgeDto } from './dto/create-xedu-edge.dto';
import { XeduEdgeQueryDto } from './dto/xedu-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('xedu/edges')
@UseGuards(JwtAuthGuard)
export class XeduEdgesController {
  constructor(private readonly xeduService: XeduService) {}

  /**
   * POST /api/v1/xedu/edges
   * Create a directed edge between two Xedu nodes.
   * Validates no cycle is created for hierarchical edges.
   * Triggers closure table rebuild for hierarchical edges.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'district_officer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateXeduEdgeDto) {
    return this.xeduService.createEdge(dto);
  }

  /**
   * GET /api/v1/xedu/edges
   * List edges with optional fromNodeId, toNodeId, edgeType filters.
   */
  @Get()
  findAll(@Query() query: XeduEdgeQueryDto) {
    return this.xeduService.findEdges(query);
  }

  /**
   * DELETE /api/v1/xedu/edges/:id
   * Delete an edge.
   * Triggers closure table rebuild for hierarchical edges.
   */
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.xeduService.deleteEdge(id);
  }
}
