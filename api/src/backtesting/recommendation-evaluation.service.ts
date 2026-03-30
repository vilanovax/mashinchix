import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BacktestStrategyName,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { priceOnOrBefore } from './price-series.util';
import { buildStrategyContext, weekIndexFromStart } from './backtesting-context';
import { maxDrawdownFromEquity } from './equity.engine';

@Injectable()
export class RecommendationEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateHistorically(
    startDate: Date,
    endDate: Date,
    persist = false,
  ): Promise<{
    recommendationReturn: number;
    recommendationWinRate: number;
    recommendationAvgReturn: number;
    recommendationDrawdown: number;
    weeksSampled: number;
    detail: Array<{ week: number; avgForwardReturn: number }>;
  }> {
    if (endDate <= startDate) {
      throw new BadRequestException('بازه نامعتبر است');
    }

    const startMs = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );

    const ctx = await buildStrategyContext(this.prisma, startDate, endDate);

    const sessions = await this.prisma.recommendationSession.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'asc' },
      include: { results: { orderBy: { rank: 'asc' } } },
    });

    const usedWeek = new Set<number>();
    const detail: Array<{ week: number; avgForwardReturn: number }> = [];
    const forward: number[] = [];

    for (const s of sessions) {
      const wk = weekIndexFromStart(startMs, s.createdAt.getTime());
      if (usedWeek.has(wk)) continue;
      usedWeek.add(wk);
      const cars = [...s.results]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3)
        .map((r) => r.carId);
      if (!cars.length) continue;

      const dayMs = s.createdAt.getTime();
      let gi = ctx.globalDates.findIndex((t) => t >= dayMs);
      if (gi < 0) gi = ctx.globalDates.length - 1;
      const t0 = ctx.globalDates[gi];
      const t1 = ctx.globalDates[Math.min(gi + 7, ctx.globalDates.length - 1)];

      let sumR = 0;
      let n = 0;
      for (const carId of cars) {
        const ser = ctx.series.get(carId);
        if (!ser) continue;
        const p0 = priceOnOrBefore(ser, t0);
        const p1 = priceOnOrBefore(ser, t1);
        if (p0 != null && p1 != null && p0 > 0) {
          sumR += p1 / p0 - 1;
          n++;
        }
      }
      if (n === 0) continue;
      const avg = sumR / n;
      forward.push(avg);
      detail.push({ week: wk, avgForwardReturn: avg });
    }

    if (!forward.length) {
      return {
        recommendationReturn: 0,
        recommendationWinRate: 0,
        recommendationAvgReturn: 0,
        recommendationDrawdown: 0,
        weeksSampled: 0,
        detail: [],
      };
    }

    const cumulative = [1];
    for (const r of forward) {
      cumulative.push(cumulative[cumulative.length - 1] * (1 + r));
    }
    const recommendationReturn = cumulative[cumulative.length - 1] - 1;
    const recommendationAvgReturn =
      forward.reduce((a, b) => a + b, 0) / forward.length;
    const recommendationWinRate =
      forward.filter((x) => x > 0).length / forward.length;
    const recommendationDrawdown = maxDrawdownFromEquity(cumulative);

    if (persist) {
      await this.prisma.backtestResult.create({
        data: {
          strategyName: BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL,
          startDate: new Date(startMs),
          endDate: new Date(
            Date.UTC(
              endDate.getUTCFullYear(),
              endDate.getUTCMonth(),
              endDate.getUTCDate(),
            ),
          ),
          totalReturn: recommendationReturn,
          annualReturn:
            forward.length > 0
              ? Math.pow(1 + recommendationReturn, 52 / forward.length) - 1
              : 0,
          maxDrawdown: recommendationDrawdown,
          winRate: recommendationWinRate,
          tradesCount: forward.length,
          metadata: {
            recommendationAvgReturn,
            weeksSampled: forward.length,
            detail: detail.slice(0, 40),
          } as Prisma.InputJsonValue,
        },
      });
    }

    return {
      recommendationReturn,
      recommendationWinRate,
      recommendationAvgReturn,
      recommendationDrawdown,
      weeksSampled: forward.length,
      detail,
    };
  }
}
