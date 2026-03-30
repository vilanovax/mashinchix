import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BacktestStrategyName,
  PortfolioSimulation,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildStrategyContext } from './backtesting-context';
import { runEquitySimulation } from './equity.engine';

@Injectable()
export class PortfolioSimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async runSimulation(input: {
    strategy: BacktestStrategyName;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    userId?: string;
  }): Promise<PortfolioSimulation> {
    if (
      input.strategy === BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL
    ) {
      throw new BadRequestException('این استراتژی برای شبیه‌سازی پورتفو معتبر نیست');
    }
    if (input.endDate <= input.startDate) {
      throw new BadRequestException('بازه نامعتبر است');
    }
    if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0) {
      throw new BadRequestException('سرمایهٔ اولیه نامعتبر است');
    }

    let ctx;
    try {
      ctx = await buildStrategyContext(
        this.prisma,
        input.startDate,
        input.endDate,
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT_DATA') {
        throw new BadRequestException('دادهٔ تاریخچه کافی نیست');
      }
      if (e instanceof Error && e.message === 'INSUFFICIENT_DAYS') {
        throw new BadRequestException('روزهای معاملاتی کم است');
      }
      throw e;
    }

    const res = runEquitySimulation(input.strategy, ctx);
    const v0 = res.equity[0] ?? 1;
    const v1 = res.equity[res.equity.length - 1] ?? v0;
    const mult = v0 > 0 ? v1 / v0 : 1;
    const initial = new Prisma.Decimal(input.initialCapital);
    const finalVal = new Prisma.Decimal(input.initialCapital * mult);

    return this.prisma.portfolioSimulation.create({
      data: {
        userId: input.userId,
        strategy: input.strategy,
        startDate: new Date(
          Date.UTC(
            input.startDate.getUTCFullYear(),
            input.startDate.getUTCMonth(),
            input.startDate.getUTCDate(),
          ),
        ),
        endDate: new Date(
          Date.UTC(
            input.endDate.getUTCFullYear(),
            input.endDate.getUTCMonth(),
            input.endDate.getUTCDate(),
          ),
        ),
        initialCapital: initial,
        finalCapital: finalVal,
        totalReturn: res.totalReturn,
        maxDrawdown: res.maxDrawdown,
        metadata: {
          tradesCount: res.tradesCount,
          annualReturn: res.annualReturn,
          winRate: res.winRate,
          sharpeLike: res.sharpeLike,
        } as Prisma.InputJsonValue,
      },
    });
  }

  listSimulations(limit = 40, userId?: string) {
    const take = Math.min(Math.max(limit, 1), 150);
    return this.prisma.portfolioSimulation.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async performanceSummary() {
    const [avgReturn, worstDd, byStrategy] = await Promise.all([
      this.prisma.portfolioSimulation.aggregate({
        _avg: { totalReturn: true },
      }),
      this.prisma.portfolioSimulation.aggregate({
        _min: { totalReturn: true },
      }),
      this.prisma.portfolioSimulation.groupBy({
        by: ['strategy'],
        _avg: { totalReturn: true, maxDrawdown: true },
        _count: { id: true },
      }),
    ]);
    return {
      simulationsCount: await this.prisma.portfolioSimulation.count(),
      avgTotalReturn: avgReturn._avg.totalReturn,
      minObservedReturn: worstDd._min.totalReturn,
      byStrategy: byStrategy.map((r) => ({
        strategy: r.strategy,
        runs: r._count.id,
        avgReturn: r._avg.totalReturn,
        avgMaxDrawdown: r._avg.maxDrawdown,
      })),
    };
  }
}
