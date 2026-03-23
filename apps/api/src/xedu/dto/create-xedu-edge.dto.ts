import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { EdgeType } from '@prisma/client';

export class CreateXeduEdgeDto {
  @IsUUID()
  fromNodeId: string;

  @IsUUID()
  toNodeId: string;

  @IsEnum(EdgeType)
  edgeType: EdgeType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
