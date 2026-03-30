import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addCalendarDays,
  priceOnOrAfter,
  priceOnOrBeforeDb,
  startOfUtcDay,
  subCalendarDays,
} from './eval-price.util';

@Injectable()
export class RecommendationPerformanceService {
  private readonly logger = new Logger(RecommendationPerformanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runBackfill(asOf: Date = new Date(), maxSessions = 400): Promise<{
    created: number;
  }> {
    const today = startOfUtcDay(asOf);
    const oldestOk = subCalendarDays(today, 120);

    const sessions = await this.prisma.recommendationSession.findMany({
      where: {
        createdAt: { lte: oldestOk },
        performance: { is: null },
      },
      include: {
        results: { orderBy: { rank: 'asc' } },
      },
      take: maxSessions,
      orderBy: { createdAt: 'asc' },
    });

    let created = 0;

    for (const s of sessions) {
      if (!s.results.length) continue;
      const base = s.createdAt;
      const rets7: number[] = [];
      const rets30: number[] = [];
      const rets90: number[] = [];

      for (const r of s.results) {
        const p0 = await priceOnOrBeforeDb(this.prisma, r.carId, base);
        if (p0 == null || p0 <= 0) continue;
        const p7 = await priceOnOrAfter(
          this.prisma,
          r.carId,
          addCalendarDays(base, 7),
        );
        const p30 = await priceOnOrAfter(
          this.prisma,
          r.carId,
          addCalendarDays(base, 30),
        );
        const p90 = await priceOnOrAfter(
          this.prisma,
          r.carId,
          addCalendarDays(base, 90),
        );
        if (p7 != null && p7 > 0) rets7.push(p7 / p0 - 1);
        if (p30 != null && p30 > 0) rets30.push(p30 / p0 - 1);
        if (p90 != null && p90 > 0) rets90.push(p90 / p0 - 1);
      }

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      await this.prisma.recommendationPerformance.create({
        data: {
          recommendationSessionId: s.id,
          avgReturn7d: avg(rets7) ?? undefined,
          avgReturn30d: avg(rets30) ?? undefined,
          avgReturn90d: avg(rets90) ?? undefined,
          clicked: s.results.some((x) => x.wasClicked),
          saved: s.results.some((x) => x.wasSaved),
          dismissed: s.results.some((x) => x.wasDismissed),
        },
      });
      created++;
    }

    this.logger.log(`RecommendationPerformance created: ${created}`);
    return { created };
  }
}
