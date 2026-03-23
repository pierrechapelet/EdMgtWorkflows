import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '@edmgt/shared-types';

/**
 * Extracts the refresh token from the request body alongside the JWT payload.
 * The raw refresh token is attached to the request for rotation in AuthService.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): { userId: string; refreshToken: string } {
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken ?? '';
    return { userId: payload.sub, refreshToken };
  }
}
