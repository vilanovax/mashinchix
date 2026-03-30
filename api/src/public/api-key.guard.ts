import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ApiKeyService } from './api-key.service';

function extractKey(req: Request): string | undefined {
  const h = req.headers['x-api-key'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ApiKeyService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<string>('PUBLIC_API_REQUIRE_KEY') === 'false') {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const secret = extractKey(req);
    if (!secret) {
      throw new UnauthorizedException('کلید API الزامی است (هدر X-Api-Key یا Bearer)');
    }

    const row = await this.keys.findActiveBySecret(secret);
    if (!row) {
      throw new UnauthorizedException('کلید API نامعتبر است');
    }

    this.keys.enforceRateLimit(row);
    return true;
  }
}
