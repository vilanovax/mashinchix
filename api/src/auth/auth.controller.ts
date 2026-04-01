import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PatchUserSettingsDto } from './dto/patch-user-settings.dto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PatchWizardDto } from './dto/patch-wizard.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieBase(res: Response) {
    const secure = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private attachCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const base = this.cookieBase(res);
    res.cookie('access_token', accessToken, {
      ...base,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      ...base,
      maxAge: 7 * 24 * 3600 * 1000,
    });
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.register(dto);
    this.attachCookies(res, out.accessToken, out.refreshToken);
    return {
      user: out.user,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    };
  }

  /** بدون Passport local تا ابتدا ValidationPipe روی بدنه اجرا شود و با Nest هم‌تراز بماند */
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.auth.validateCredentials(dto.email, dto.password);
    if (!row) {
      throw new UnauthorizedException('ایمیل یا رمز نادرست است');
    }
    const out = await this.auth.login({
      sub: row.id,
      email: row.email,
    });
    this.attachCookies(res, out.accessToken, out.refreshToken);
    return {
      user: out.user,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const token =
      body?.refreshToken?.trim() ||
      (req.cookies?.refresh_token as string | undefined);
    const out = await this.auth.refresh(token);
    this.attachCookies(res, out.accessToken, out.refreshToken);
    return {
      user: out.user,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutFromRefresh(
      req.cookies?.refresh_token as string | undefined,
    );
    const base = this.cookieBase(res);
    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', base);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('sub') userId: string | undefined) {
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.toPublicUser(userId);
    if (!user) throw new UnauthorizedException();
    return { user };
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  async patchSettings(
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: PatchUserSettingsDto,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.auth.patchUserSettings(userId, dto);
  }

  @Patch('wizard')
  @UseGuards(JwtAuthGuard)
  async patchWizard(
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: PatchWizardDto,
  ) {
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.patchWizard(userId, dto);
    if (!user) throw new UnauthorizedException();
    return { user };
  }
}
