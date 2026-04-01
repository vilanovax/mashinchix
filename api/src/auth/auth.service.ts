import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { PatchUserSettingsDto } from './dto/patch-user-settings.dto';
import type { PatchWizardDto } from './dto/patch-wizard.dto';
import type { AuthUserShape } from './decorators/current-user.decorator';

type RefreshJwtPayload = { sub: string; sid: string; typ: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private accessSecret(): string {
    return this.config.get<string>('JWT_SECRET', 'dev-jwt-secret-change-me');
  }

  private refreshSecret(): string {
    return this.config.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret-change-me',
    );
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string } | null> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (!user?.passwordHash || !user.email) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return { id: user.id, email: user.email };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
      },
    });
    await this.prisma.userSettings.create({
      data: { userId: user.id },
    });
    return this.issueTokensForUser(user.id, user.email!);
  }

  async login(authUser: AuthUserShape) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
    });
    if (!user?.email) {
      throw new UnauthorizedException('کاربر نامعتبر است');
    }
    return this.issueTokensForUser(user.id, user.email);
  }

  private async issueTokensForUser(userId: string, email: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const session = await this.prisma.userSession.create({
      data: { userId, expiresAt },
    });
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      {
        secret: this.accessSecret(),
        expiresIn: '15m',
      },
    );
    const refreshToken = this.jwt.sign(
      {
        sub: userId,
        sid: session.id,
        typ: 'refresh',
      } satisfies RefreshJwtPayload,
      {
        secret: this.refreshSecret(),
        expiresIn: '7d',
      },
    );
    const user = await this.toPublicUser(userId);
    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken?.length) {
      throw new UnauthorizedException('نشست نامعتبر است');
    }
    let payload: RefreshJwtPayload;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.refreshSecret(),
      }) as RefreshJwtPayload;
    } catch {
      throw new UnauthorizedException('توکن تازه‌سازی منقضی یا نامعتبر است');
    }
    if (payload.typ !== 'refresh' || !payload.sid || !payload.sub) {
      throw new UnauthorizedException('توکن تازه‌سازی نامعتبر است');
    }
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      throw new UnauthorizedException('نشست پایان یافته است');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.email) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokensForUser(user.id, user.email);
  }

  async logoutFromRefresh(refreshToken: string | undefined) {
    if (!refreshToken?.length) return;
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.refreshSecret(),
      }) as RefreshJwtPayload;
      if (payload.typ === 'refresh' && payload.sid) {
        await this.prisma.userSession.updateMany({
          where: { id: payload.sid, userId: payload.sub },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      /* noop */
    }
  }

  async logoutAllSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private static readonly WIZARD_SCORE_KEYS = [
    'performance',
    'comfort',
    'economy',
    'reliability',
    'market',
    'ownership',
    'prestige',
  ] as const;

  /** ویزارد MVP: User + UserProfile.scoreWeights برای موتور v3 */
  async patchWizard(userId: string, dto: PatchWizardDto) {
    const raw = dto.preferences.weights;
    const nums = AuthService.WIZARD_SCORE_KEYS.map((k) =>
      Math.max(0, Number(raw[k] ?? 1)),
    );
    const sum = nums.reduce((a, b) => a + b, 0) || 1;
    const scoreWeights: Record<string, number> = {};
    AuthService.WIZARD_SCORE_KEYS.forEach((k, i) => {
      scoreWeights[k] = nums[i] / sum;
    });
    scoreWeights.risk = Math.max(0, Number(raw.risk ?? 0.12));

    const budgetDec = new Prisma.Decimal(String(Math.round(dto.budget)));
    const prefsJson: Prisma.InputJsonValue = {
      weights: scoreWeights,
    };

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          budget: budgetDec,
          listingCondition: dto.listingCondition,
          holdYears: dto.holdYears ?? null,
          usageTags: dto.usageTags,
          usageType: dto.usageTags[0] ?? null,
          riskLevel: dto.riskLevel,
          previousCarIds: dto.previousCarIds ?? [],
          preferences: prefsJson,
          wizardCompletedAt: new Date(),
        },
      }),
      this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          maxBudget: budgetDec,
          scoreWeights: scoreWeights as Prisma.InputJsonValue,
        },
        update: {
          maxBudget: budgetDec,
          scoreWeights: scoreWeights as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.toPublicUser(userId);
  }

  async patchUserSettings(userId: string, dto: PatchUserSettingsDto) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        theme: dto.theme,
        language: dto.language,
        currency: dto.currency,
        timezone: dto.timezone,
        defaultPortfolioId: dto.defaultPortfolioId,
        notificationsEnabled: dto.notificationsEnabled ?? true,
      },
      update: {
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.defaultPortfolioId !== undefined
          ? { defaultPortfolioId: dto.defaultPortfolioId }
          : {}),
        ...(dto.notificationsEnabled !== undefined
          ? { notificationsEnabled: dto.notificationsEnabled }
          : {}),
      },
    });
  }

  async toPublicUser(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true, profile: true },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      budget: u.budget?.toString() ?? null,
      riskLevel: u.riskLevel,
      usageType: u.usageType,
      usageTags: u.usageTags,
      listingCondition: u.listingCondition,
      holdYears: u.holdYears,
      preferences: u.preferences,
      previousCarIds: u.previousCarIds,
      wizardCompletedAt: u.wizardCompletedAt,
      createdAt: u.createdAt,
      settings: u.settings,
      profile: u.profile,
    };
  }
}
