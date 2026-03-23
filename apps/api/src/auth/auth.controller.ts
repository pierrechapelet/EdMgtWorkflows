import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaConfirmDto, MfaVerifyDto, MfaChallengeDto } from './dto/mfa.dto';
import { RefreshDto, LogoutDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '@edmgt/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Create a new user account. No role assignment — requires admin to grant roles.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/login
   * Returns TokenPair if MFA is disabled.
   * Returns { mfaRequired: true, mfaToken } if MFA is enabled.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/mfa/challenge
   * Complete login when MFA is required.
   * Body: { mfaToken (from login), code (6-digit TOTP) }
   */
  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  completeMfaLogin(@Body() dto: MfaChallengeDto) {
    return this.authService.completeMfaLogin(dto);
  }

  /**
   * POST /api/v1/auth/mfa/setup
   * Initiate MFA setup for authenticated user.
   * Returns: { secret, qrCodeDataUrl, otpAuthUrl }
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  setupMfa(@CurrentUser() user: RequestUser) {
    return this.authService.setupMfa(user.id);
  }

  /**
   * POST /api/v1/auth/mfa/confirm
   * Confirm MFA setup by verifying the first TOTP code.
   * Activates MFA on the account.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  confirmMfa(@CurrentUser() user: RequestUser, @Body() dto: MfaConfirmDto) {
    return this.authService.confirmMfa(user.id, dto);
  }

  /**
   * POST /api/v1/auth/mfa/verify
   * Verify a TOTP code when already authenticated (e.g., before sensitive actions).
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  verifyMfa(@CurrentUser() user: RequestUser, @Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(user.id, dto);
  }

  /**
   * POST /api/v1/auth/refresh
   * Exchange a valid refresh token for a new token pair (rotation).
   */
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @CurrentUser() user: { userId: string; refreshToken: string },
    @Body() _dto: RefreshDto,
  ) {
    return this.authService.refreshTokens(user.userId, user.refreshToken);
  }

  /**
   * POST /api/v1/auth/logout
   * Revoke the provided refresh token.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: RequestUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  /**
   * GET /api/v1/auth/me
   * Returns the current authenticated user's basic profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
