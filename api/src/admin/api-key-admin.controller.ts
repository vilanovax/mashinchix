import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/api-keys')
export class ApiKeyAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * یک‌بار کلید برمی‌گرداند؛ در production فقط با محدودیت دسترسی فعال کنید.
   */
  @Post()
  async create(
    @Body()
    body: {
      name: string;
      rateLimit?: number;
    },
  ) {
    if (this.config.get<string>('ALLOW_ADMIN_API_KEYS') !== 'true') {
      return {
        ok: false,
        error: 'Set ALLOW_ADMIN_API_KEYS=true in .env to enable this endpoint',
      };
    }

    const key = `mk_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.apiKey.create({
      data: {
        key,
        name: body.name || 'unnamed',
        rateLimit: body.rateLimit ?? 60,
      },
    });

    return {
      ok: true,
      id: row.id,
      key,
      rateLimit: row.rateLimit,
      hint: 'این کلید فقط همین پاسخ نمایش داده می‌شود؛ در X-Api-Key یا Authorization: Bearer ارسال کنید.',
    };
  }
}
