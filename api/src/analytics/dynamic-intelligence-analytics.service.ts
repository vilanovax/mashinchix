import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DynamicIntelligenceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async marketCycles(limit = 60) {
    const take = Math.min(Math.max(limit, 1), 500);
    return this.prisma.marketCycle.findMany({
      orderBy: [{ snapshotDate: 'desc' }, { segment: 'asc' }],
      take,
    });
  }

  async marketMomentum(top = 25) {
    const n = Math.min(Math.max(top, 1), 100);
    const rows = await this.prisma.carMarketData.findMany({
      where: { momentumScore: { not: null } },
      orderBy: { momentumScore: 'desc' },
      take: n,
      include: {
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            segment: true,
            year: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      carId: r.carId,
      momentumScore: r.momentumScore,
      priceChange7d: r.priceChange7d,
      priceChange30d: r.priceChange30d,
      priceChange90d: r.priceChange90d,
      car: r.car,
    }));
  }

  async marketLiquidityTrends(top = 25) {
    const n = Math.min(Math.max(top, 1), 100);
    const rows = await this.prisma.carMarketData.findMany({
      where: { liquidityTrendScore: { not: null } },
      orderBy: { liquidityTrendScore: 'desc' },
      take: n,
      include: {
        car: {
          select: { id: true, brand: true, model: true, segment: true },
        },
      },
    });
    return rows.map((r) => ({
      carId: r.carId,
      liquidityTrendScore: r.liquidityTrendScore,
      liquidityTrendLabel: r.liquidityTrendLabel,
      listingsLast7d: r.listingsLast7d,
      listingsPrev7d: r.listingsPrev7d,
      listingsLast30d: r.listingsLast30d,
      listingsPrev30d: r.listingsPrev30d,
      car: {
        id: r.car.id,
        brand: r.car.brand,
        model: r.car.model,
        segment: r.car.segment,
      },
    }));
  }

  async intelligenceTop(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 150);
    return this.prisma.car.findMany({
      where: { scores: { overallScore: { not: null } } },
      orderBy: { scores: { overallScore: 'desc' } },
      take,
      include: {
        scores: {
          select: {
            overallScore: true,
            modelVersion: true,
            riskScore: true,
            investmentScore: true,
          },
        },
      },
    });
  }

  async highRisk(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 150);
    return this.prisma.car.findMany({
      where: { scores: { riskScore: { not: null } } },
      orderBy: { scores: { riskScore: 'desc' } },
      take,
      include: {
        scores: {
          select: {
            riskScore: true,
            overallScore: true,
            marketScore: true,
          },
        },
        marketData: {
          select: {
            volatilityScore: true,
            volatilityTrendLabel: true,
            momentumScore: true,
          },
        },
      },
    });
  }

  async bestInvestment(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 150);
    return this.prisma.car.findMany({
      where: { scores: { investmentScore: { not: null } } },
      orderBy: { scores: { investmentScore: 'desc' } },
      take,
      include: {
        scores: {
          select: {
            investmentScore: true,
            overallScore: true,
          },
        },
        marketData: {
          select: { marketSignal: true, momentumScore: true },
        },
      },
    });
  }

  async fastestSelling(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 150);
    const rows = await this.prisma.$queryRaw<
      Array<{
        carId: string;
        avgDaysToSell: number | null;
        medianDaysToSell: number | null;
        sellThroughRate: number | null;
        snapshotDate: Date;
      }>
    >`
      SELECT DISTINCT ON ("carId") "carId", "avgDaysToSell", "medianDaysToSell", "sellThroughRate", "snapshotDate"
      FROM "CarLiquidityStats"
      WHERE "avgDaysToSell" IS NOT NULL AND "avgDaysToSell" > 0
      ORDER BY "carId", "snapshotDate" DESC
    `;
    const sorted = [...rows].sort(
      (a, b) => (a.avgDaysToSell ?? 999) - (b.avgDaysToSell ?? 999),
    );
    const slice = sorted.slice(0, take);
    const cars = await this.prisma.car.findMany({
      where: { id: { in: slice.map((s) => s.carId) } },
      select: { id: true, brand: true, model: true, segment: true },
    });
    const cmap = new Map(cars.map((c) => [c.id, c]));
    return slice.map((s) => ({
      ...s,
      car: cmap.get(s.carId) ?? null,
    }));
  }
}
