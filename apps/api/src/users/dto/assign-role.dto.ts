import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  roleId: string;

  @IsUUID()
  xeduNodeId: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
