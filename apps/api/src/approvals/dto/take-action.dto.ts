import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ApprovalActionEnum {
  Approve = 'approve',
  Reject = 'reject',
  Forward = 'forward',
  RequestCorrection = 'request_correction',
}

export class TakeActionDto {
  @IsEnum(ApprovalActionEnum)
  action: ApprovalActionEnum;

  /** Optional reviewer comment — stored in approval_events */
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}
