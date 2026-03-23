import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionDto {
  @IsOptional() @IsBoolean() canRead?: boolean;
  @IsOptional() @IsBoolean() canWrite?: boolean;
  @IsOptional() @IsBoolean() canCreate?: boolean;
  @IsOptional() @IsBoolean() canDelete?: boolean;
  @IsOptional() @IsBoolean() canApprove?: boolean;
  @IsOptional() @IsBoolean() canReject?: boolean;
  @IsOptional() @IsBoolean() canForward?: boolean;
  @IsOptional() @IsBoolean() inheritsToChildren?: boolean;
}
