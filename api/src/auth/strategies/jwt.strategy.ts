import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthUserShape } from '../decorators/current-user.decorator';

type JwtPayload = { sub: string; email: string };

function fromCookieOrBearer(req: Request): string | null {
  const cookie = req?.cookies?.access_token as string | undefined;
  if (cookie) return cookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: fromCookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-jwt-secret-change-me'),
    });
  }

  validate(payload: JwtPayload): AuthUserShape {
    return { sub: payload.sub, email: payload.email };
  }
}
