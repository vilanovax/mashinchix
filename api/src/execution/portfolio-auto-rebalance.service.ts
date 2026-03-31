import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  PortfolioRecommendationService,
  type RecommendPortfolioParams,
} from '../portfolio/portfolio-recommendation.service';
import type { PortfolioRebalanceResult, RebalanceTrade } from './execution.types';
import {
  totalVariationDistance,
  weightMapFromCars,
} from './execution-portfolio.util';

@Injectable()
export class PortfolioAutoRebalanceService {
  private readonly txCostBps: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendation: PortfolioRecommendationService,
    private readonly config: ConfigService,
  ) {
    this.txCostBps = Number(
      this.config.get<string>('EXECUTION_TX_COST_BPS', '50'),
    );
  }

  async rebalanceForUser(userId: string): Promise<PortfolioRebalanceResult> {
    return this.analyze(userId);
  }

  async analyze(userId: string): Promise<PortfolioRebalanceResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const last = await this.prisma.userPortfolioRecommendation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!last) {
      return {
        ok: false,
        userId,
        drift: null,
        trades: [],
        urgency: 0,
        recommendedTiming: 'WAIT',
        rebalanceMode: 'PARTIAL',
        transactionCostBps: this.txCostBps,
        notes: [
          'توصیهٔ ذخیره‌شده‌ای برای محاسبهٔ واگرایی وجود ندارد؛ ابتدا portfolio/recommend را اجرا کنید.',
        ],
      };
    }

    const rawParams = last.params as Partial<RecommendPortfolioParams> | null;
    const budget = Number(rawParams?.budget ?? last.budget ?? user.budget ?? 0);
    if (!Number.isFinite(budget) || budget < 1) {
      return {
        ok: false,
        userId,
        drift: null,
        trades: [],
        urgency: 0,
        recommendedTiming: 'WAIT',
        rebalanceMode: 'PARTIAL',
        transactionCostBps: this.txCostBps,
        notes: ['بودجهٔ معتبر برای بازتولید سبد بهینه نیست.'],
      };
    }

    const params: RecommendPortfolioParams = {
      budget: Math.round(budget),
      riskTolerance: rawParams?.riskTolerance ?? 'MEDIUM',
      investmentHorizonMonths: rawParams?.investmentHorizonMonths ?? 36,
      preferredSegments: rawParams?.preferredSegments,
      maxCars: rawParams?.maxCars ?? 5,
      strategyPreference: rawParams?.strategyPreference ?? 'balanced',
      userId,
      persist: false,
    };

    const currentResult = last.result as {
      cars?: Array<{ carId: string; weight?: number }>;
      expectedReturn?: number;
      expectedVolatility?: number;
      expectedDrawdown?: number;
    };


    const optimal = await this.recommendation.recommendPortfolio(params);
    const optOut = optimal as {
      cars?: Array<{ carId: string; weight?: number }>;
      expectedReturn?: number;
      expectedVolatility?: number;
      expectedDrawdown?: number;
    };

    const curCars = currentResult?.cars ?? [];
    const optCars = optOut.cars ?? [];

    const wmCur = weightMapFromCars(curCars);
    const wmOpt = weightMapFromCars(
      optCars.map((c) => ({ carId: c.carId, weight: c.weight })),
    );
    const drift = totalVariationDistance(wmCur, wmOpt);

    const trades: RebalanceTrade[] = [];
    const keys = new Set([...wmCur.keys(), ...wmOpt.keys()]);
    for (const carId of keys) {
      const dw = (wmOpt.get(carId) ?? 0) - (wmCur.get(carId) ?? 0);
      if (Math.abs(dw) < 0.002) continue;
      trades.push({
        carId,
        side: dw >= 0 ? 'BUY' : 'SELL',
        deltaWeight: dw,
        deltaWeightPct: Math.round(dw * 10_000) / 100,
      });
    }
    trades.sort((a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight));

    const liqVol = await this.prisma.carMarketData.aggregate({
      _avg: { volatilityScore: true },
      where: { volatilityScore: { not: null } },
    });
    const volAvg = liqVol._avg.volatilityScore ?? 0;
    const highVolRegime = volAvg >= 72;

    let urgency = Math.min(
      100,
      Math.round(drift * 100) + (highVolRegime ? 12 : 0),
    );
    if (user.riskLevel === 'HIGH') urgency = Math.min(100, urgency + 5);
    if (user.riskLevel === 'LOW') urgency = Math.max(0, urgency - 5);

    let recommendedTiming: PortfolioRebalanceResult['recommendedTiming'] =
      'WAIT';
    if (urgency >= 72) recommendedTiming = 'NOW';
    else if (urgency >= 38) recommendedTiming = 'THIS_WEEK';

    const rebalanceCostFriction = (this.txCostBps / 10_000) * trades.length * 0.35;
    const netBenefitProxy = drift - rebalanceCostFriction;
    if (netBenefitProxy < 0.02 && recommendedTiming === 'NOW') {
      recommendedTiming = 'THIS_WEEK';
    }

    const rebalanceMode: PortfolioRebalanceResult['rebalanceMode'] =
      drift >= 0.15 ? 'FULL' : 'PARTIAL';

    const notes: string[] = [];
    notes.push(
      `واگرایی وزن‌ها ≈ ${(drift * 100).toFixed(1)}٪؛ هزینهٔ تقریبی تراکنش فرض ${this.txCostBps} bps.`,
    );
    if (highVolRegime) {
      notes.push('نوسان بازار بالاست؛ ری‌بالانس جزئی یا تأخیر کوتاه‌مدت منطقی‌تر است.');
    }

    return {
      ok: true,
      userId,
      drift,
      trades,
      urgency,
      recommendedTiming,
      rebalanceMode,
      transactionCostBps: this.txCostBps,
      notes,
      currentSnapshot: {
        expectedReturn: currentResult?.expectedReturn,
        expectedVolatility: currentResult?.expectedVolatility,
        expectedDrawdown: currentResult?.expectedDrawdown,
      },
      optimalSnapshot: {
        expectedReturn: optOut.expectedReturn,
        expectedVolatility: optOut.expectedVolatility,
        expectedDrawdown: optOut.expectedDrawdown,
      },
    };
  }
}
