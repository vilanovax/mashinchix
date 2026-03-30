import { Injectable } from '@nestjs/common';
import { AlertSeverity, InsightType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicIntelligenceAnalyticsService } from './dynamic-intelligence-analytics.service';
import { MarketAnalyticsService } from './market-analytics.service';

const OPPORTUNITY_INSIGHTS: InsightType[] = [
  InsightType.BEST_INVESTMENT_OPPORTUNITY,
  InsightType.UNDERVALUED,
  InsightType.FASTEST_SELLING,
  InsightType.HIGH_DEMAND_LOW_SUPPLY,
  InsightType.LIQUIDITY_SPIKE,
  InsightType.DEMAND_SPIKE,
  InsightType.ENTERING_BULL_TREND,
];

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class MarketIntelligenceAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamic: DynamicIntelligenceAnalyticsService,
    private readonly market: MarketAnalyticsService,
  ) {}

  async latestInsights(opts?: {
    limit?: number;
    insightType?: InsightType;
    snapshotDate?: string;
  }) {
    const take = Math.min(Math.max(opts?.limit ?? 80, 1), 300);
    const where: Prisma.MarketInsightWhereInput = {};
    if (opts?.insightType) where.insightType = opts.insightType;
    if (opts?.snapshotDate) {
      where.snapshotDate = startOfUtcDay(new Date(opts.snapshotDate));
    }
    return this.prisma.marketInsight.findMany({
      where,
      orderBy: [{ snapshotDate: 'desc' }, { score: 'desc' }],
      take,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  async insightsCars(opts?: { limit?: number; snapshotDate?: string }) {
    const take = Math.min(Math.max(opts?.limit ?? 60, 1), 250);
    const where: Prisma.MarketInsightWhereInput = { carId: { not: null } };
    if (opts?.snapshotDate) {
      where.snapshotDate = startOfUtcDay(new Date(opts.snapshotDate));
    }
    return this.prisma.marketInsight.findMany({
      where,
      orderBy: [{ snapshotDate: 'desc' }, { score: 'desc' }],
      take,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  async insightsSegments(opts?: { limit?: number; snapshotDate?: string }) {
    const take = Math.min(Math.max(opts?.limit ?? 40, 1), 200);
    const where: Prisma.MarketInsightWhereInput = {
      segment: { not: null },
      carId: null,
    };
    if (opts?.snapshotDate) {
      where.snapshotDate = startOfUtcDay(new Date(opts.snapshotDate));
    }
    return this.prisma.marketInsight.findMany({
      where,
      orderBy: [{ snapshotDate: 'desc' }, { score: 'desc' }],
      take,
    });
  }

  async alerts(opts?: {
    limit?: number;
    severity?: AlertSeverity;
    activeOnly?: boolean;
  }) {
    const take = Math.min(Math.max(opts?.limit ?? 100, 1), 400);
    const where: Prisma.MarketAlertWhereInput = {};
    if (opts?.severity) where.severity = opts.severity;
    if (opts?.activeOnly !== false) where.isActive = true;
    return this.prisma.marketAlert.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  async opportunities(opts?: { limit?: number; snapshotDate?: string }) {
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const where: Prisma.MarketInsightWhereInput = {
      insightType: { in: OPPORTUNITY_INSIGHTS },
    };
    if (opts?.snapshotDate) {
      where.snapshotDate = startOfUtcDay(new Date(opts.snapshotDate));
    }
    return this.prisma.marketInsight.findMany({
      where,
      orderBy: [{ snapshotDate: 'desc' }, { score: 'desc' }],
      take,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  async marketReport() {
    const today = startOfUtcDay(new Date());
    const latestInsight = await this.prisma.marketInsight.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });
    const snap =
      latestInsight?.snapshotDate &&
      latestInsight.snapshotDate.getTime() > 0
        ? startOfUtcDay(latestInsight.snapshotDate)
        : today;

    const [
      marketCycles,
      topRising,
      topFalling,
      bestInvestments,
      highestRisk,
      fastestSelling,
      segmentTrends,
      volOverview,
      liqOverview,
    ] = await Promise.all([
      this.dynamic.marketCycles(40),
      this.sortedCarInsights(InsightType.FASTEST_RISING_PRICE, snap, 12),
      this.sortedCarInsights(InsightType.FASTEST_FALLING_PRICE, snap, 12),
      this.sortedCarInsights(InsightType.BEST_INVESTMENT_OPPORTUNITY, snap, 12),
      this.sortedCarInsights(InsightType.HIGH_RISK_ALERT, snap, 12),
      this.dynamic.fastestSelling(12),
      this.market.latestSegmentIndices(),
      this.volatilityOverview(),
      this.liquidityOverview(),
    ]);

    return {
      generatedFor: snap.toISOString().slice(0, 10),
      marketCycle: marketCycles.slice(0, 24),
      topRisingCars: topRising,
      topFallingCars: topFalling,
      bestInvestments,
      highestRiskCars: highestRisk,
      fastestSellingCars: fastestSelling,
      segmentTrends,
      volatilityOverview: volOverview,
      liquidityOverview: liqOverview,
      activeAlertsCount: await this.prisma.marketAlert.count({
        where: { isActive: true },
      }),
    };
  }

  private async sortedCarInsights(
    type: InsightType,
    snapshotDate: Date,
    take: number,
  ) {
    return this.prisma.marketInsight.findMany({
      where: { insightType: type, snapshotDate },
      orderBy: { score: 'desc' },
      take,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  private async volatilityOverview() {
    const rows = await this.prisma.carMarketData.findMany({
      where: { volatilityScore: { not: null } },
      select: {
        carId: true,
        volatilityScore: true,
        volatilityTrendLabel: true,
        volatilityRaw: true,
      },
      orderBy: { volatilityScore: 'asc' },
      take: 30,
    });
    const cars = await this.prisma.car.findMany({
      where: { id: { in: rows.map((r) => r.carId) } },
      select: { id: true, brand: true, model: true, segment: true },
    });
    const cmap = new Map(cars.map((c) => [c.id, c]));
    return rows.map((r) => ({
      ...r,
      car: cmap.get(r.carId) ?? null,
    }));
  }

  private async liquidityOverview() {
    const rows = await this.prisma.carMarketData.findMany({
      where: { liquidityScore: { not: null } },
      select: {
        carId: true,
        liquidityScore: true,
        liquidityTrendLabel: true,
        liquidityTrendScore: true,
        adsCount: true,
      },
      orderBy: { liquidityScore: 'desc' },
      take: 30,
    });
    const cars = await this.prisma.car.findMany({
      where: { id: { in: rows.map((r) => r.carId) } },
      select: { id: true, brand: true, model: true, segment: true },
    });
    const cmap = new Map(cars.map((c) => [c.id, c]));
    return rows.map((r) => ({
      ...r,
      car: cmap.get(r.carId) ?? null,
    }));
  }
}
