import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  coefficientOfVariation,
  mean,
  median,
  stdev,
  trimmedMean,
} from '../common/stats.util';
import { PrismaService } from '../prisma/prisma.service';
import { computeDynamicMarketFields } from './market-dynamics.helper';

const listingSelectClean = {
  isExcluded: false,
} as const;

/** شیب خط از داده‌های (0..n-1, y) نسبت به میانگین y */
function trendSlopeNormalized(ys: number[]): number | null {
  const m = mean(ys);
  if (ys.length < 2 || m == null || m === 0) return null;
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = m;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (ys[i] - my);
    den += (i - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return Math.max(-1, Math.min(1, slope / my));
}

function labelFromTrend(score: number | null): string | null {
  if (score == null) return null;
  if (score > 0.02) return 'RISING';
  if (score < -0.02) return 'FALLING';
  return 'STABLE';
}

const MIN_VOLATILITY_RETURNS = 5;

function volatilityFromOrderedPrices(
  prices: number[],
): { volatilityRaw: number | null; volatilityScore: number | null } {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (p0 > 0 && Number.isFinite(p1)) {
      returns.push((p1 - p0) / p0);
    }
  }
  if (returns.length < MIN_VOLATILITY_RETURNS) {
    return { volatilityRaw: null, volatilityScore: null };
  }
  const volatilityRaw = stdev(returns);
  const volatilityScore = Math.max(
    0,
    Math.min(100, 100 - volatilityRaw * 1000),
  );
  return {
    volatilityRaw: Math.round(volatilityRaw * 1000000) / 1000000,
    volatilityScore: Math.round(volatilityScore * 10) / 10,
  };
}

function robustPriceAggregate(
  prices: number[],
): { center: number | null; minv: number | null; maxv: number | null } {
  const valid = prices.filter((p) => Number.isFinite(p));
  if (!valid.length) return { center: null, minv: null, maxv: null };
  const minv = Math.min(...valid);
  const maxv = Math.max(...valid);
  const center =
    valid.length >= 8
      ? trimmedMean(valid, 0.1)
      : valid.length >= 4
        ? median(valid)
        : mean(valid);
  return { center, minv, maxv };
}

/**
 * نقدشوندگی، افت قیمت، روند و تقاضا — فقط لیستینگ isExcluded=false؛
 * قیمت مرکزی: trimmedMean / median؛ نقدشوندگی با جریمهٔ پراکندگی (CV).
 */
@Injectable()
export class MarketMetricsService {
  private readonly logger = new Logger(MarketMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * انحراف معیار بازده و امتیاز نوسان (۰=پر نوسان) از سری روزانهٔ PriceHistory.
   */
  async computeVolatilityForCar(carId: string): Promise<{
    volatilityRaw: number | null;
    volatilityScore: number | null;
  }> {
    const d65 = new Date(Date.now() - 65 * 86400000);
    const rows = await this.prisma.priceHistory.findMany({
      where: { carId, date: { gte: d65 } },
      orderBy: { date: 'asc' },
    });
    const prices = rows
      .map((r) => r.price.toNumber())
      .filter((n) => Number.isFinite(n));
    return volatilityFromOrderedPrices(prices);
  }

  async recomputeAll(): Promise<{ carsUpdated: number }> {
    const cars = await this.prisma.car.findMany({
      where: {
        OR: [
          { listings: { some: { isExcluded: false } } },
          { marketData: { isNot: null } },
        ],
      },
      select: { id: true },
    });

    let carsUpdated = 0;
    for (const c of cars) {
      await this.recomputeForCar(c.id);
      carsUpdated += 1;
    }
    this.logger.log(`Market metrics updated for ${carsUpdated} cars`);
    return { carsUpdated };
  }

  async recomputeForCar(carId: string): Promise<void> {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000);
    const d14 = new Date(now.getTime() - 14 * 86400000);
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);

    const [l0_7, l7_14, l0_30, l30_60] = await Promise.all([
      this.prisma.carListing.findMany({
        where: { carId, scrapedAt: { gte: d7 }, ...listingSelectClean },
        select: { price: true },
      }),
      this.prisma.carListing.findMany({
        where: {
          carId,
          scrapedAt: { gte: d14, lt: d7 },
          ...listingSelectClean,
        },
        select: { price: true },
      }),
      this.prisma.carListing.findMany({
        where: { carId, scrapedAt: { gte: d30 }, ...listingSelectClean },
        select: { price: true },
      }),
      this.prisma.carListing.findMany({
        where: {
          carId,
          scrapedAt: { gte: d60, lt: d30 },
          ...listingSelectClean,
        },
        select: { price: true },
      }),
    ]);

    const p0_30 = l0_30.map((x) => x.price.toNumber());
    const p30_60 = l30_60.map((x) => x.price.toNumber());
    const aggRecent = robustPriceAggregate(p0_30);
    const aggPrev = robustPriceAggregate(p30_60);
    const avgRecent = aggRecent.center;
    const avgPrev = aggPrev.center;

    let depreciationRate30d: number | null = null;
    if (avgPrev != null && avgPrev > 0 && avgRecent != null) {
      depreciationRate30d = (avgRecent - avgPrev) / avgPrev;
    }

    const history = await this.prisma.priceHistory.findMany({
      where: { carId, date: { gte: new Date(now.getTime() - 90 * 86400000) } },
      orderBy: { date: 'asc' },
      take: 60,
    });
    const ys = history
      .map((h) => h.price.toNumber())
      .filter((n) => Number.isFinite(n));
    const priceTrendScore = trendSlopeNormalized(ys);
    const priceTrendLabel = labelFromTrend(priceTrendScore);

    const n7 = l0_7.length;
    const nPrev7 = l7_14.length;
    let demandScore: number | null = null;
    if (nPrev7 > 0) {
      demandScore = Math.max(
        0,
        Math.min(100, 50 + 50 * ((n7 - nPrev7) / nPrev7)),
      );
    } else if (n7 > 0) {
      demandScore = 70;
    }

    const adsCount = await this.prisma.carListing.count({
      where: { carId, scrapedAt: { gte: d30 }, ...listingSelectClean },
    });

    const ads7 = await this.prisma.carListing.count({
      where: { carId, scrapedAt: { gte: d7 }, ...listingSelectClean },
    });
    const adsPrev7 = await this.prisma.carListing.count({
      where: {
        carId,
        scrapedAt: { gte: d14, lt: d7 },
        ...listingSelectClean,
      },
    });
    const listingsPrev30Count = l30_60.length;
    const listingsLast30Count = l0_30.length;

    const trendRatio = (ads7 - adsPrev7) / Math.max(adsPrev7, 1);
    const popularityTrendScore =
      Math.round(Math.max(-100, Math.min(100, trendRatio * 100)) * 10) / 10;
    let popularityTrend: string | null = null;
    if (ads7 > 0 || adsPrev7 > 0) {
      if (trendRatio > 0.15) popularityTrend = 'RISING';
      else if (trendRatio < -0.15) popularityTrend = 'FALLING';
      else popularityTrend = 'STABLE';
    }

    const phVol = await this.computeVolatilityForCar(carId);

    const dynamicFields = await computeDynamicMarketFields(
      this.prisma,
      carId,
      {
        n7: l0_7.length,
        nPrev7: l7_14.length,
        n30: listingsLast30Count,
        nPrev30: listingsPrev30Count,
      },
    );

    const cv = coefficientOfVariation(p0_30);
    let liquidityScore: number | null = null;
    if (adsCount > 0 && avgRecent != null) {
      const base = Math.min(
        100,
        28 + 22 * Math.log10(adsCount + 1) + Math.min(28, adsCount / 5),
      );
      const dispersionPenalty =
        cv != null ? Math.min(35, cv * 80) : 0;
      liquidityScore = Math.max(5, base - dispersionPenalty);
    }

    let minPrice: Prisma.Decimal | undefined;
    let maxPrice: Prisma.Decimal | undefined;
    let avgPriceField: Prisma.Decimal | undefined;
    if (l0_30.length > 0 && avgRecent != null) {
      minPrice =
        aggRecent.minv != null
          ? new Prisma.Decimal(aggRecent.minv)
          : undefined;
      maxPrice =
        aggRecent.maxv != null
          ? new Prisma.Decimal(aggRecent.maxv)
          : undefined;
      avgPriceField = new Prisma.Decimal(avgRecent);
    }

    const updatePayload: Prisma.CarMarketDataUpdateInput = {
      adsCount,
      metricsComputedAt: now,
    };
    if (liquidityScore != null) {
      updatePayload.liquidityScore = liquidityScore;
    }
    if (depreciationRate30d != null) {
      updatePayload.depreciationRate30d = new Prisma.Decimal(
        depreciationRate30d,
      );
    }
    if (priceTrendScore != null) {
      updatePayload.priceTrendScore = priceTrendScore;
    }
    if (priceTrendLabel != null) {
      updatePayload.priceTrendLabel = priceTrendLabel;
    }
    if (demandScore != null) {
      updatePayload.demandScore = demandScore;
    }
    if (phVol.volatilityRaw != null) {
      updatePayload.volatilityRaw = phVol.volatilityRaw;
      updatePayload.volatilityScore = phVol.volatilityScore;
    } else {
      updatePayload.volatilityRaw = null;
      updatePayload.volatilityScore = null;
    }
    if (popularityTrend != null) {
      updatePayload.popularityTrend = popularityTrend;
      updatePayload.popularityTrendScore = popularityTrendScore;
    }
    if (minPrice) updatePayload.minPrice = minPrice;
    if (maxPrice) updatePayload.maxPrice = maxPrice;
    if (avgPriceField) updatePayload.avgPrice = avgPriceField;

    updatePayload.priceChange7d = dynamicFields.priceChange7d;
    updatePayload.priceChange30d = dynamicFields.priceChange30d;
    updatePayload.priceChange90d = dynamicFields.priceChange90d;
    updatePayload.momentumScore = dynamicFields.momentumScore;
    updatePayload.listingsLast7d = dynamicFields.listingsLast7d;
    updatePayload.listingsPrev7d = dynamicFields.listingsPrev7d;
    updatePayload.listingsLast30d = dynamicFields.listingsLast30d;
    updatePayload.listingsPrev30d = dynamicFields.listingsPrev30d;
    updatePayload.liquidityTrendScore = dynamicFields.liquidityTrendScore;
    updatePayload.liquidityTrendLabel = dynamicFields.liquidityTrendLabel;
    updatePayload.volatilityTrendScore = dynamicFields.volatilityTrendScore;
    updatePayload.volatilityTrendLabel = dynamicFields.volatilityTrendLabel;

    const existing = await this.prisma.carMarketData.findUnique({
      where: { carId },
    });
    if (existing) {
      await this.prisma.carMarketData.update({
        where: { carId },
        data: updatePayload,
      });
    } else if (avgPriceField != null) {
      const create: Prisma.CarMarketDataCreateInput = {
        car: { connect: { id: carId } },
        adsCount,
        avgPrice: avgPriceField,
        metricsComputedAt: now,
      };
      if (minPrice) create.minPrice = minPrice;
      if (maxPrice) create.maxPrice = maxPrice;
      if (liquidityScore != null) create.liquidityScore = liquidityScore;
      if (depreciationRate30d != null) {
        create.depreciationRate30d = new Prisma.Decimal(depreciationRate30d);
      }
      if (priceTrendScore != null) create.priceTrendScore = priceTrendScore;
      if (priceTrendLabel != null) create.priceTrendLabel = priceTrendLabel;
      if (demandScore != null) create.demandScore = demandScore;
      if (phVol.volatilityRaw != null) {
        create.volatilityRaw = phVol.volatilityRaw;
        create.volatilityScore = phVol.volatilityScore;
      }
      if (popularityTrend != null) {
        create.popularityTrend = popularityTrend;
        create.popularityTrendScore = popularityTrendScore;
      }
      create.priceChange7d = dynamicFields.priceChange7d ?? undefined;
      create.priceChange30d = dynamicFields.priceChange30d ?? undefined;
      create.priceChange90d = dynamicFields.priceChange90d ?? undefined;
      create.momentumScore = dynamicFields.momentumScore ?? undefined;
      create.listingsLast7d = dynamicFields.listingsLast7d;
      create.listingsPrev7d = dynamicFields.listingsPrev7d;
      create.listingsLast30d = dynamicFields.listingsLast30d;
      create.listingsPrev30d = dynamicFields.listingsPrev30d;
      create.liquidityTrendScore = dynamicFields.liquidityTrendScore ?? undefined;
      create.liquidityTrendLabel = dynamicFields.liquidityTrendLabel ?? undefined;
      create.volatilityTrendScore = dynamicFields.volatilityTrendScore ?? undefined;
      create.volatilityTrendLabel =
        dynamicFields.volatilityTrendLabel ?? undefined;
      await this.prisma.carMarketData.create({ data: create });
    }
  }
}
