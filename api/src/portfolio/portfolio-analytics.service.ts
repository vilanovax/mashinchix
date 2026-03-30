import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioRecommendationService } from './portfolio-recommendation.service';
import { simulateBuyAndHoldWeighted } from './custom-portfolio-sim.util';

@Injectable()
export class PortfolioAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommend: PortfolioRecommendationService,
  ) {}

  /** نمونهٔ توصیه با پارامترهای متعادل (برای داشبورد) */
  bestAllocationSample() {
    return this.recommend.recommendPortfolio({
      budget: 800_000_000,
      riskTolerance: 'MEDIUM',
      investmentHorizonMonths: 12,
      maxCars: 6,
      strategyPreference: 'balanced',
      persist: false,
    });
  }

  async riskReturnScatter(limit = 120) {
    const take = Math.min(Math.max(limit, 20), 300);
    const cars = await this.prisma.car.findMany({
      where: {
        marketData: { volatilityScore: { not: null } },
        pricePrediction: { predictedChange90d: { not: null } },
      },
      take,
      include: { marketData: true, pricePrediction: true },
    });
    return cars.map((c) => ({
      carId: c.id,
      segment: c.segment,
      brand: c.brand,
      model: c.model,
      volatilityScore: c.marketData?.volatilityScore ?? null,
      predictedChange90d: c.pricePrediction?.predictedChange90d
        ? Number(c.pricePrediction.predictedChange90d)
        : null,
    }));
  }

  async efficientFrontier(options?: { persist?: boolean; samples?: number }) {
    const nSamples = Math.min(Math.max(options?.samples ?? 36, 10), 80);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 200);

    const pool = await this.prisma.car.findMany({
      where: {
        scores: { investmentScore: { not: null } },
      },
      include: { scores: true },
      take: 120,
    });
    pool.sort(
      (a, b) =>
        (b.scores?.investmentScore ?? 0) - (a.scores?.investmentScore ?? 0),
    );
    const top = pool.slice(0, 10);
    if (top.length < 3) {
      return { ok: false, message: 'نمونه خودرو کافی نیست', points: [] };
    }
    const ids = top.map((c) => c.id);

    const points: Array<{
      risk: number;
      return: number;
      allocation: Array<{ carId: string; weight: number }>;
    }> = [];

    const rngWeights = (n: number): number[] => {
      const raw = Array.from({ length: n }, () => Math.random() + 0.05);
      const s = raw.reduce((a, b) => a + b, 0);
      return raw.map((x) => x / s);
    };

    for (let k = 0; k < nSamples; k++) {
      const w = rngWeights(ids.length);
      const sim = await simulateBuyAndHoldWeighted(
        this.prisma,
        ids,
        w,
        start,
        end,
      );
      if (!sim) continue;
      points.push({
        risk: sim.annualVolatility,
        return: sim.annualReturn,
        allocation: ids.map((id, i) => ({ carId: id, weight: w[i] })),
      });
    }

    points.sort((a, b) => a.risk - b.risk);

    if (options?.persist && points.length) {
      await this.prisma.portfolioFrontier.createMany({
        data: points.map((p) => ({
          risk: p.risk,
          return: p.return,
          allocation: p.allocation as unknown as object,
          methodology: 'monte-carlo-universe',
        })),
      });
    }

    return {
      ok: true,
      universeCarIds: ids,
      window: { start: start.toISOString(), end: end.toISOString() },
      points,
      persisted: Boolean(options?.persist),
    };
  }

  async diversificationOverview() {
    const cars = await this.prisma.car.findMany({
      where: { scores: { investmentScore: { not: null } } },
      include: { scores: true },
      take: 200,
    });
    cars.sort(
      (a, b) =>
        (b.scores?.investmentScore ?? 0) - (a.scores?.investmentScore ?? 0),
    );
    const top = cars.slice(0, 40);
    const bySeg = new Map<string, number>();
    for (const c of top) {
      const s = c.segment || 'نامشخص';
      bySeg.set(s, (bySeg.get(s) ?? 0) + 1);
    }
    const n = top.length || 1;
    let herfindahl = 0;
    const segmentShares: Record<string, number> = {};
    for (const [seg, cnt] of bySeg) {
      const sh = cnt / n;
      segmentShares[seg] = Math.round(sh * 1000) / 1000;
      herfindahl += sh * sh;
    }
    return {
      sampleSize: top.length,
      herfindahlIndex: Math.round(herfindahl * 1000) / 1000,
      segmentShares,
      interpretation:
        herfindahl < 0.15
          ? 'پراکندگی سگمنتی نسبتاً خوب در نمونهٔ برتر'
          : 'تمرکز سگمنتی بالا در نمونهٔ برتر — تنوع بیشتر پیشنهاد می‌شود.',
    };
  }

  async segmentAllocationRecommended() {
    const cars = await this.prisma.car.findMany({
      where: {
        segment: { not: null },
        scores: { investmentScore: { not: null } },
      },
      include: { scores: true },
    });
    const bestBySeg = new Map<string, (typeof cars)[0]>();
    for (const c of cars) {
      const seg = c.segment!;
      const prev = bestBySeg.get(seg);
      const inv = c.scores?.investmentScore ?? -1;
      if (!prev || (prev.scores?.investmentScore ?? -1) < inv) bestBySeg.set(seg, c);
    }
    const picks = [...bestBySeg.values()];
    const invSum = picks.reduce(
      (a, c) => a + (c.scores?.investmentScore ?? 0),
      0,
    );
    return picks.map((c) => {
      const inv = c.scores?.investmentScore ?? 0;
      const w = invSum > 0 ? inv / invSum : 1 / picks.length;
      return {
        segment: c.segment,
        carId: c.id,
        brand: c.brand,
        model: c.model,
        investmentScore: inv,
        suggestedWeight: Math.round(w * 1000) / 1000,
      };
    });
  }

  async frontierHistory(limit = 40) {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.portfolioFrontier.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
