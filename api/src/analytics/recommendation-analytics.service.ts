import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

@Injectable()
export class RecommendationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** CTR / save rate به تفکیک رتبهٔ لیست + سگمنت‌ها و خودروهای پربازده */
  async recommendationPerformance() {
    const results = await this.prisma.recommendationResult.findMany({
      select: {
        rank: true,
        finalScore: true,
        wasClicked: true,
        wasSaved: true,
        wasDismissed: true,
        carId: true,
        car: {
          select: { segment: true, brand: true, model: true },
        },
      },
    });

    type RankAgg = { impressions: number; clicks: number; saves: number };
    const byRank = new Map<number, RankAgg>();
    for (const r of results) {
      const a = byRank.get(r.rank) ?? {
        impressions: 0,
        clicks: 0,
        saves: 0,
      };
      a.impressions += 1;
      if (r.wasClicked) a.clicks += 1;
      if (r.wasSaved) a.saves += 1;
      byRank.set(r.rank, a);
    }

    const ctrByPosition = [...byRank.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([rank, v]) => ({
        rank,
        impressions: v.impressions,
        clicks: v.clicks,
        saves: v.saves,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        saveRate: v.impressions > 0 ? v.saves / v.impressions : 0,
      }));

    const clicked = results.filter((r) => r.wasClicked);
    const notClicked = results.filter((r) => !r.wasClicked);
    const averageScoreWhenClicked =
      clicked.length > 0 ? mean(clicked.map((r) => r.finalScore)) : null;
    const averageScoreWhenNotClicked =
      notClicked.length > 0
        ? mean(notClicked.map((r) => r.finalScore))
        : null;

    type SegAgg = { impressions: number; clicks: number; saves: number };
    const segMap = new Map<string, SegAgg>();
    for (const r of results) {
      const seg = r.car?.segment?.trim() || 'unknown';
      const a = segMap.get(seg) ?? {
        impressions: 0,
        clicks: 0,
        saves: 0,
      };
      a.impressions += 1;
      if (r.wasClicked) a.clicks += 1;
      if (r.wasSaved) a.saves += 1;
      segMap.set(seg, a);
    }

    const mostSuccessfulSegments = [...segMap.entries()]
      .map(([segment, v]) => {
        const ctr = v.impressions > 0 ? v.clicks / v.impressions : 0;
        const saveRate = v.impressions > 0 ? v.saves / v.impressions : 0;
        return {
          segment,
          impressions: v.impressions,
          ctr,
          saveRate,
          engagementScore: ctr * 0.55 + saveRate * 0.45,
        };
      })
      .filter((x) => x.impressions >= 3)
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 30);

    const savedAgg = await this.prisma.recommendationResult.groupBy({
      by: ['carId'],
      where: { wasSaved: true },
      _count: { carId: true },
      orderBy: { _count: { carId: 'desc' } },
      take: 25,
    });

    const savedCarIds = savedAgg.map((s) => s.carId);
    const cars = await this.prisma.car.findMany({
      where: { id: { in: savedCarIds } },
      select: { id: true, brand: true, model: true, segment: true },
    });
    const carById = new Map(cars.map((c) => [c.id, c]));

    const mostSavedCarsAfterRecommendation = savedAgg.map((row) => ({
      carId: row.carId,
      saveCount: row._count.carId,
      car: carById.get(row.carId) ?? null,
    }));

    return {
      totalResultRows: results.length,
      ctrByPosition,
      saveRateByPosition: ctrByPosition.map(({ rank, saveRate, impressions }) => ({
        rank,
        saveRate,
        impressions,
      })),
      averageRecommendationScoreWhenClicked: averageScoreWhenClicked,
      averageRecommendationScoreWhenNotClicked: averageScoreWhenNotClicked,
      mostSuccessfulSegments,
      mostSavedCarsAfterRecommendation,
    };
  }
}
