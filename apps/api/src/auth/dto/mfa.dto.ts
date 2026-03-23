import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  /** 6-digit TOTP code from authenticator app */
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class MfaConfirmDto {
  /** 6-digit TOTP code to confirm MFA setup */
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class MfaChallengeDto {
  /** Short-lived JWT returned by /auth/login when MFA is required */
  @IsString()
  mfaToken: string;

  /** 6-digit TOTP code */
  @IsString()
  @Length(6, 6)
  code: string;
}
