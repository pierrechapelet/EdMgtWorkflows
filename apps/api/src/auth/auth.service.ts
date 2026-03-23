import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaConfirmDto, MfaVerifyDto, MfaChallengeDto } from './dto/mfa.dto';
import { TokenPair, MfaChallengeResponse, JwtPayload } from '@edmgt/shared-types';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Registration ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new AppException('EMAIL_IN_USE', 'Email address already registered', 409);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        preferredLang: dto.preferredLang ?? 'en',
      },
      select: {
        id: true,
        email: true,
        phone: true,
        preferredLang: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    return user;
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<TokenPair | MfaChallengeResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Constant-time comparison to prevent user enumeration
    const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
    const passwordValid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !user.isActive || !passwordValid) {
      throw new AppException('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (user.mfaEnabled) {
      // Issue a short-lived MFA challenge token
      const mfaToken = this.jwt.sign(
        { sub: user.id, mfaPending: true } satisfies JwtPayload,
        {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.issueTokenPair(user.id);
  }

  // ─── MFA: complete login after TOTP challenge ────────────────────────────────

  async completeMfaLogin(dto: MfaChallengeDto): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(dto.mfaToken, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new AppException('INVALID_MFA_TOKEN', 'MFA token is invalid or expired', 401);
    }

    if (!payload.mfaPending) {
      throw new AppException('INVALID_MFA_TOKEN', 'Token is not an MFA challenge token', 401);
    }

    return this.verifyTotpAndIssue(payload.sub, dto.code);
  }

  // ─── MFA setup: generate secret + QR code ───────────────────────────────────

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.mfaEnabled) {
      throw new AppException('MFA_ALREADY_ENABLED', 'MFA is already enabled on this account', 400);
    }

    const secret = authenticator.generateSecret(20);
    const otpAuthUrl = authenticator.keyuri(user.email, 'EdMgtWorkflows', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    // Store pending secret (not yet confirmed)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, qrCodeDataUrl, otpAuthUrl };
  }

  // ─── MFA confirm: verify first TOTP code, activate MFA ──────────────────────

  async confirmMfa(userId: string, dto: MfaConfirmDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.mfaSecret) {
      throw new AppException('MFA_NOT_SETUP', 'MFA setup has not been initiated', 400);
    }
    if (user.mfaEnabled) {
      throw new AppException('MFA_ALREADY_ENABLED', 'MFA is already enabled', 400);
    }

    const valid = authenticator.verify({ token: dto.code, secret: user.mfaSecret });
    if (!valid) throw new AppException('INVALID_MFA_CODE', 'Invalid TOTP code', 401);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { mfaEnabled: true };
  }

  // ─── MFA verify (standalone — used if caller holds a valid access token) ─────

  async verifyMfa(userId: string, dto: MfaVerifyDto) {
    return this.verifyTotpAndIssue(userId, dto.code);
  }

  // ─── Token refresh (rotation) ────────────────────────────────────────────────

  async refreshTokens(userId: string, rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new AppException('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired', 401);
    }

    // Rotate: revoke old token, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(userId);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async verifyTotpAndIssue(userId: string, code: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.mfaSecret) {
      throw new AppException('MFA_NOT_SETUP', 'MFA is not configured', 400);
    }

    const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!valid) throw new AppException('INVALID_MFA_CODE', 'Invalid TOTP code', 401);

    return this.issueTokenPair(userId);
  }

  private async issueTokenPair(userId: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const rawRefreshToken = this.generateSecureToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshExpiryDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiryDays);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private generateSecureToken(): string {
    return randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
