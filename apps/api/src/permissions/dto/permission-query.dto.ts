import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class PermissionQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  xeduNodeId?: string;

  @IsOptional()
  @IsUUID()
  formTemplateId?: string;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsUUID()
  workflowStepId?: string;
}
