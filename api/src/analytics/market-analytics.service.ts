import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

type LatestSegmentIndexRow = {
  id: string;
  segment: string;
  snapshotDate: Date;
  indexValue: number;
  avgPredictedChange30d: number | null;
  liquidityAvg: number | null;
  demandAvg: number | null;
  carCount: number;
  methodology: string | null;
};

@Injectable()
export class MarketAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      carCount,
      listingsWithMarket,
      marketAvg,
      scoresAvg,
      reviewRows,
      ownershipRows,
      predictionRows,
    ] = await Promise.all([
      this.prisma.car.count(),
      this.prisma.carMarketData.count(),
      this.prisma.carMarketData.aggregate({
        _avg: {
          liquidityScore: true,
          demandScore: true,
          adsCount: true,
        },
      }),
      this.prisma.carScores.aggregate({
        _avg: {
          overallScore: true,
          popularityScore: true,
          ownerSatisfactionScore: true,
          riskScore: true,
          investmentScore: true,
        },
      }),
      this.prisma.carReviewsRaw.count(),
      this.prisma.ownershipCost.count({
        where: { fuelMonthlyTomans: { not: null } },
      }),
      this.prisma.pricePrediction.count(),
    ]);

    return {
      cars: carCount,
      carsWithMarketData: listingsWithMarket,
      reviewsTotal: reviewRows,
      ownershipCostRowsWithFuel: ownershipRows,
      predictionsRows: predictionRows,
      marketAverages: {
        liquidityScore: marketAvg._avg.liquidityScore,
        demandScore: marketAvg._avg.demandScore,
        adsCount: marketAvg._avg.adsCount,
      },
      scoreAverages: {
        overallScore: scoresAvg._avg.overallScore,
        popularityScore: scoresAvg._avg.popularityScore,
        ownerSatisfactionScore: scoresAvg._avg.ownerSatisfactionScore,
        riskScore: scoresAvg._avg.riskScore,
        investmentScore: scoresAvg._avg.investmentScore,
      },
    };
  }

  async segmentBreakdown() {
    type Row = {
      segment: string;
      cars: number;
      avgOverall: number | null;
      avgPopularity: number | null;
      avgLiquidity: number | null;
      avgDemand: number | null;
    };

    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT c."segment" AS segment,
        COUNT(*)::int AS cars,
        ROUND(AVG(cs."overallScore")::numeric, 2)::float AS "avgOverall",
        ROUND(AVG(cs."popularityScore")::numeric, 2)::float AS "avgPopularity",
        ROUND(AVG(md."liquidityScore")::numeric, 2)::float AS "avgLiquidity",
        ROUND(AVG(md."demandScore")::numeric, 2)::float AS "avgDemand"
      FROM "Car" c
      LEFT JOIN "CarScores" cs ON cs."carId" = c."id"
      LEFT JOIN "CarMarketData" md ON md."carId" = c."id"
      WHERE c."segment" IS NOT NULL AND c."segment" != ''
      GROUP BY c."segment"
      ORDER BY COUNT(*) DESC
    `;

    return { segments: rows };
  }

  async priceTrendDistribution() {
    const rows = await this.prisma.carMarketData.groupBy({
      by: ['priceTrendLabel'],
      where: {
        priceTrendLabel: { not: null },
      },
      _count: { _all: true },
    });

    const sorted = [...rows].sort((a, b) => b._count._all - a._count._all);

    return {
      distribution: sorted.map((r) => ({
        label: r.priceTrendLabel,
        count: r._count._all,
      })),
    };
  }

  /** میانگین افت ۳۰روزه به‌صورت عدد (برای نمودار کلی بازار) */
  async depreciationSummary() {
    const rows = await this.prisma.carMarketData.findMany({
      where: { depreciationRate30d: { not: null } },
      select: { depreciationRate30d: true },
    });
    const vals = rows
      .map((r) => toNumber(r.depreciationRate30d))
      .filter((v): v is number => v != null);
    if (vals.length === 0) {
      return { count: 0, avgDepreciationRate30d: null, min: null, max: null };
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      count: vals.length,
      avgDepreciationRate30d:
        Math.round((sum / vals.length) * 10000) / 10000,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }

  /** خلاصهٔ پیش‌بینی‌های ذخیره‌شده */
  async predictionsSummary() {
    const [total, withModel, agg] = await Promise.all([
      this.prisma.pricePrediction.count(),
      this.prisma.pricePrediction.count({
        where: {
          methodology: { startsWith: 'ols_linear' },
        },
      }),
      this.prisma.pricePrediction.aggregate({
        where: {
          methodology: { startsWith: 'ols_linear' },
        },
        _avg: {
          confidence: true,
          predictedChange30d: true,
        },
      }),
    ]);

    return {
      totalPredictions: total,
      withTrendModel: withModel,
      avgConfidence: agg._avg.confidence,
      avgPredictedChange30d:
        agg._avg.predictedChange30d != null
          ? toNumber(agg._avg.predictedChange30d)
          : null,
    };
  }

  async latestSegmentIndices() {
    const rows = await this.prisma.$queryRaw<LatestSegmentIndexRow[]>`
      SELECT DISTINCT ON (s."segment")
        s."id",
        s."segment",
        s."snapshotDate" AS "snapshotDate",
        s."indexValue" AS "indexValue",
        s."avgPredictedChange30d" AS "avgPredictedChange30d",
        s."liquidityAvg" AS "liquidityAvg",
        s."demandAvg" AS "demandAvg",
        s."carCount" AS "carCount",
        s."methodology"
      FROM "SegmentMarketIndex" s
      ORDER BY s."segment", s."snapshotDate" DESC
    `;
    return { segments: rows, count: rows.length };
  }

  async segmentIndexHistory(segment: string, days: number) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(1, Math.min(days, 730)));
    const rows = await this.prisma.segmentMarketIndex.findMany({
      where: {
        segment,
        snapshotDate: { gte: since },
      },
      orderBy: { snapshotDate: 'asc' },
    });
    return { segment, days, points: rows };
  }
}
