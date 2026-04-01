import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { AuthUserShape } from '../decorators/current-user.decorator';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<AuthUserShape> {
    const row = await this.auth.validateCredentials(email, password);
    if (!row) {
      throw new UnauthorizedException('ایمیل یا رمز نادرست است');
    }
    return { sub: row.id, email: row.email };
  }
}
