import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';

export enum ExportFormat {
  Csv = 'csv',
  Xlsx = 'xlsx',
}

export class ReportQueryDto {
  /** Scope to a sub-tree rooted at this node (optional; defaults to campaign owner node) */
  @IsOptional()
  @IsUUID()
  nodeId?: string;
}

export class ExportQueryDto {
  @IsEnum(ExportFormat)
  format: ExportFormat = ExportFormat.Csv;
}

export class GeoQueryDto {
  /** Bounding box: "minLng,minLat,maxLng,maxLat" */
  @IsOptional()
  @IsString()
  bbox?: string;
}
