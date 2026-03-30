import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyService {
  /** apiKeyId → timestamps (ms) در پنجرهٔ یک دقیقه */
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  async findActiveBySecret(secret: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({
      where: { key: secret, isActive: true },
    });
  }

  enforceRateLimit(row: ApiKey): void {
    const now = Date.now();
    const windowMs = 60_000;
    const arr = (this.buckets.get(row.id) ?? []).filter(
      (t) => now - t < windowMs,
    );
    if (arr.length >= row.rateLimit) {
      throw new HttpException(
        'محدودیت نرخ درخواست',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    arr.push(now);
    this.buckets.set(row.id, arr);
  }
}
