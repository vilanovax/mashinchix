import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  BacktestStrategyName,
  BacktestResult,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { runEquitySimulation } from './equity.engine';
import { buildStrategyContext } from './backtesting-context';

@Injectable()
export class BacktestingService {
  constructor(private readonly prisma: PrismaService) {}

  async runBacktest(
    strategy: BacktestStrategyName,
    startDate: Date,
    endDate: Date,
  ): Promise<BacktestResult> {
    if (strategy === BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL) {
      throw new BadRequestException(
        'برای ارزیابی توصیه‌ها از سرویس RecommendationEvaluation استفاده کنید',
      );
    }
    if (endDate <= startDate) {
      throw new BadRequestException('بازه نامعتبر است');
    }

    let ctx;
    try {
      ctx = await buildStrategyContext(this.prisma, startDate, endDate);
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT_DATA') {
        throw new BadRequestException('دادهٔ تاریخچهٔ کافی برای بک‌تست نیست');
      }
      if (e instanceof Error && e.message === 'INSUFFICIENT_DAYS') {
        throw new BadRequestException('تعداد روزهای معاملاتی در بازه کم است');
      }
      throw e;
    }

    const res = runEquitySimulation(strategy, ctx);

    return this.prisma.backtestResult.create({
      data: {
        strategyName: strategy,
        startDate: new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
          ),
        ),
        endDate: new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
          ),
        ),
        totalReturn: res.totalReturn,
        annualReturn: res.annualReturn,
        maxDrawdown: res.maxDrawdown,
        winRate: res.winRate,
        tradesCount: res.tradesCount,
        metadata: {
          sharpeLike: res.sharpeLike,
          universeSize: ctx.universe.length,
          tradingDays: ctx.globalDates.length,
          note: 'سیگنال‌های BUY/SELL تقریبی از میانگین متحرک قیمت؛ امتیازهای سرمایه‌گذاری/ریسک از اسنپ‌شات فعلی DB.',
        } as Prisma.InputJsonValue,
      },
    });
  }

  listBacktests(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.backtestResult.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async bestStrategies(limit = 10) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.backtestResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: 800,
    });
    const best = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      const cur = best.get(r.strategyName);
      if (!cur || r.totalReturn > cur.totalReturn) best.set(r.strategyName, r);
    }
    return Array.from(best.values())
      .sort((a, b) => b.totalReturn - a.totalReturn)
      .slice(0, take);
  }
}
