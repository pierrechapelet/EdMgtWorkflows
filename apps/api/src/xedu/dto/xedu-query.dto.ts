import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { NodeType, EdgeType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class XeduNodeQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(NodeType)
  nodeType?: NodeType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  /** Filter to descendants of a specific ancestor node */
  @IsOptional()
  @IsUUID()
  ancestorNodeId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class XeduEdgeQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  fromNodeId?: string;

  @IsOptional()
  @IsUUID()
  toNodeId?: string;

  @IsOptional()
  @IsEnum(EdgeType)
  edgeType?: EdgeType;
}
