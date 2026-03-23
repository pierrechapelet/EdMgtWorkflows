import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { JwtPayload, RequestUser } from '@edmgt/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (payload.mfaPending) {
      throw new AppException('MFA_REQUIRED', 'MFA verification required', 401);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true },
      select: {
        id: true,
        email: true,
        preferredLang: true,
        mfaEnabled: true,
        roleAssignments: {
          where: {
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          select: {
            role: { select: { id: true, code: true } },
            xeduNode: { select: { id: true, code: true, nodeType: true } },
            validFrom: true,
            validUntil: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppException('INVALID_TOKEN', 'User not found or deactivated', 401);
    }

    return user as RequestUser;
  }
}
