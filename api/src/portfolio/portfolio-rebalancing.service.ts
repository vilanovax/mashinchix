import { Injectable } from '@nestjs/common';
import type { OptimizationMethodology } from './dto/portfolio-optimize.dto';
import { PortfolioOptimizationService } from './portfolio-optimization.service';

export type RebalanceTrade = {
  carId: string;
  currentWeight: number;
  targetWeight: number;
  deltaWeight: number;
  direction: 'BUY' | 'SELL' | 'HOLD';
};

@Injectable()
export class PortfolioRebalancingService {
  constructor(
    private readonly optimization: PortfolioOptimizationService,
  ) {}

  async analyze(input: {
    currentHoldings: { carId: string; weight: number }[];
    budget: number;
    methodology?: OptimizationMethodology;
    carIds?: string[];
    maxWeightPerCar?: number;
    maxWeightPerSegment?: number;
    minLiquidity?: number;
    maxPortfolioVolatility?: number;
    riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
    mcSamples?: number;
    /** هزینهٔ تقریبی هر طرف معامله به بی‌پی‌اس (پیش‌فرض ۱۰) */
    transactionCostBpsPerSide?: number;
  }) {
    const optimal = await this.optimization.optimize({
      carIds: input.carIds,
      budget: input.budget,
      methodology: input.methodology,
      maxWeightPerCar: input.maxWeightPerCar,
      maxWeightPerSegment: input.maxWeightPerSegment,
      minLiquidity: input.minLiquidity,
      maxPortfolioVolatility: input.maxPortfolioVolatility,
      riskTolerance: input.riskTolerance,
      mcSamples: input.mcSamples,
      persist: false,
    });

    const curSum = input.currentHoldings.reduce((s, h) => s + h.weight, 0);
    const norm =
      curSum > 1e-8
        ? input.currentHoldings.map((h) => ({
            carId: h.carId,
            weight: h.weight / curSum,
          }))
        : input.currentHoldings;
    const curMap = new Map<string, number>();
    for (const h of norm) {
      curMap.set(h.carId, (curMap.get(h.carId) ?? 0) + h.weight);
    }

    const universe = new Set([...optimal.carIds, ...curMap.keys()]);
    const trades: RebalanceTrade[] = [];
    let l1Drift = 0;
    for (const carId of universe) {
      const currentWeight = curMap.get(carId) ?? 0;
      const targetWeight = optimal.weightMap[carId] ?? 0;
      const deltaWeight = targetWeight - currentWeight;
      l1Drift += Math.abs(deltaWeight);
      let direction: RebalanceTrade['direction'] = 'HOLD';
      if (deltaWeight > 0.005) direction = 'BUY';
      else if (deltaWeight < -0.005) direction = 'SELL';
      trades.push({
        carId,
        currentWeight,
        targetWeight,
        deltaWeight,
        direction,
      });
    }
    trades.sort((a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight));

    const overweight = trades.filter((t) => t.deltaWeight > 0.005);
    const underweight = trades.filter((t) => t.deltaWeight < -0.005);

    const bps = input.transactionCostBpsPerSide ?? 10;
    const turnover = l1Drift / 2;
    const friction = (turnover * 2 * bps) / 10_000;

    const { rebalanceFrequencyHintDays, rebalanceUrgency } =
      this.frequencyFromDrift(l1Drift, optimal.expectedVolatility);

    const actions = this.buildActions(trades, overweight, underweight);

    return {
      optimal,
      trades,
      drift: {
        l1: l1Drift,
        turnover,
      },
      transactionImpact: {
        assumedBpsPerSide: bps,
        estimatedFrictionFraction: friction,
        estimatedFrictionAmount: friction * input.budget,
      },
      rebalance: {
        suggestedReviewDays: rebalanceFrequencyHintDays,
        urgency: rebalanceUrgency,
        actions,
      },
      overweight: overweight.map((t) => ({ carId: t.carId, addPctPoints: t.deltaWeight * 100 })),
      underweight: underweight.map((t) => ({
        carId: t.carId,
        trimPctPoints: Math.abs(t.deltaWeight) * 100,
      })),
    };
  }

  private frequencyFromDrift(l1: number, portVol: number) {
    const v = Math.max(0.04, portVol);
    const annualDriftEstimate = l1 * Math.sqrt(252) * v * 1.2;
    let rebalanceFrequencyHintDays: number;
    let rebalanceUrgency: 'LOW' | 'MEDIUM' | 'HIGH';

    if (l1 > 0.22 || annualDriftEstimate > 0.35) {
      rebalanceFrequencyHintDays = 21;
      rebalanceUrgency = 'HIGH';
    } else if (l1 > 0.12 || annualDriftEstimate > 0.2) {
      rebalanceFrequencyHintDays = 45;
      rebalanceUrgency = 'MEDIUM';
    } else {
      rebalanceFrequencyHintDays = 120;
      rebalanceUrgency = 'LOW';
    }
    return { rebalanceFrequencyHintDays, rebalanceUrgency };
  }

  private buildActions(
    trades: RebalanceTrade[],
    overweight: RebalanceTrade[],
    underweight: RebalanceTrade[],
  ): string[] {
    const actions: string[] = [];
    const topBuy = overweight.slice(0, 5);
    const topSell = underweight.slice(0, 5);
    for (const t of topBuy) {
      actions.push(
        `افزایش سهم «${t.carId}» حدود ${(t.deltaWeight * 100).toFixed(1)} درصد نقطه`,
      );
    }
    for (const t of topSell) {
      actions.push(
        `کاهش سهم «${t.carId}» حدود ${(Math.abs(t.deltaWeight) * 100).toFixed(1)} درصد نقطه`,
      );
    }
    if (!actions.length) {
      actions.push('انحراف قابل توجه از هدف اندازه است؛ نیاز به معاملهٔ فوری نیست');
    }
    const hold = trades.filter((t) => t.direction === 'HOLD').length;
    if (hold > 0 && topBuy.length + topSell.length > 0) {
      actions.push(`${hold} دارایی نزدیک هدف بهینه است`);
    }
    return actions;
  }
}
