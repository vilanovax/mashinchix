import { Injectable, NotFoundException } from '@nestjs/common';
import { UserEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehaviorAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      totalEvents,
      totalRecommendationSessions,
      totalRecommendationClicks,
      totalWishlistAdds,
      totalRecommendationViews,
    ] = await Promise.all([
      this.prisma.userEvent.count(),
      this.prisma.recommendationSession.count(),
      this.prisma.userEvent.count({
        where: { eventType: UserEventType.RECOMMENDATION_CLICK },
      }),
      this.prisma.userEvent.count({
        where: { eventType: UserEventType.WISHLIST_ADD },
      }),
      this.prisma.userEvent.count({
        where: { eventType: UserEventType.RECOMMENDATION_VIEW },
      }),
    ]);

    const viewsForCtr = totalRecommendationViews;
    const averageCTR =
      viewsForCtr > 0 ? totalRecommendationClicks / viewsForCtr : 0;
    const averageSaveRate =
      viewsForCtr > 0 ? totalWishlistAdds / viewsForCtr : 0;

    return {
      totalEvents,
      totalRecommendationSessions,
      totalRecommendationClicks,
      totalWishlistAdds,
      averageCTR: Math.round(averageCTR * 10_000) / 10_000,
      averageSaveRate: Math.round(averageSaveRate * 10_000) / 10_000,
    };
  }

  async topCars(days: number) {
    const d = Number.isFinite(days) ? Math.min(Math.max(days, 1), 365) : 30;
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - d);

    const grouped = await this.prisma.userEvent.groupBy({
      by: ['carId', 'eventType'],
      where: {
        createdAt: { gte: start, lte: end },
        carId: { not: null },
      },
      _count: true,
    });

    type Acc = {
      clicks: number;
      saves: number;
      views: number;
      dismisses: number;
    };
    const byCar = new Map<string, Acc>();

    for (const row of grouped) {
      if (!row.carId) continue;
      let a = byCar.get(row.carId);
      if (!a) {
        a = { clicks: 0, saves: 0, views: 0, dismisses: 0 };
        byCar.set(row.carId, a);
      }
      if (row.eventType === UserEventType.RECOMMENDATION_CLICK) {
        a.clicks += row._count;
      } else if (row.eventType === UserEventType.WISHLIST_ADD) {
        a.saves += row._count;
      } else if (row.eventType === UserEventType.RECOMMENDATION_VIEW) {
        a.views += row._count;
      } else if (row.eventType === UserEventType.RECOMMENDATION_DISMISS) {
        a.dismisses += row._count;
      }
    }

    const sessions = await this.prisma.recommendationSession.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      const impressions = await this.prisma.recommendationResult.groupBy({
        by: ['carId'],
        where: { recommendationSessionId: { in: sessionIds } },
        _count: true,
      });
      for (const row of impressions) {
        let a = byCar.get(row.carId);
        if (!a) {
          a = { clicks: 0, saves: 0, views: 0, dismisses: 0 };
          byCar.set(row.carId, a);
        }
        a.views += row._count;
      }
    }

    const metrics = [...byCar.entries()]
      .map(([carId, a]) => {
        const ctr = a.views > 0 ? a.clicks / a.views : 0;
        const dismissRate = a.views > 0 ? a.dismisses / a.views : 0;
        return { carId, ...a, ctr, dismissRate };
      })
      .sort((x, y) => y.clicks - x.clicks);

    const carIds = metrics.slice(0, 50).map((m) => m.carId);
    const cars = await this.prisma.car.findMany({
      where: { id: { in: carIds } },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        segment: true,
      },
    });
    const carMap = new Map(cars.map((c) => [c.id, c]));

    return {
      days: d,
      topByClicks: metrics.slice(0, 20).map((m) => ({
        ...m,
        car: carMap.get(m.carId) ?? null,
      })),
      topBySaves: [...metrics]
        .sort((a, b) => b.saves - a.saves)
        .slice(0, 20)
        .map((m) => ({
          ...m,
          car: carMap.get(m.carId) ?? null,
        })),
      topByCtr: [...metrics]
        .filter((m) => m.views >= 3)
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, 20)
        .map((m) => ({
          ...m,
          car: carMap.get(m.carId) ?? null,
        })),
      topByDismissRate: [...metrics]
        .filter((m) => m.views >= 3)
        .sort((a, b) => b.dismissRate - a.dismissRate)
        .slice(0, 20)
        .map((m) => ({
          ...m,
          car: carMap.get(m.carId) ?? null,
        })),
    };
  }

  async userBehavior(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`کاربر ${userId} یافت نشد`);
    }

    const [recentEvents, preferenceSignal, segmentGroups, carGroups] =
      await Promise.all([
        this.prisma.userEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            car: {
              select: {
                id: true,
                brand: true,
                model: true,
                segment: true,
              },
            },
          },
        }),
        this.prisma.userPreferenceSignal.findFirst({
          where: { userId },
          orderBy: { signalDate: 'desc' },
        }),
        this.prisma.userEvent.groupBy({
          by: ['carId'],
          where: {
            userId,
            carId: { not: null },
          },
          _count: true,
          orderBy: { _count: { carId: 'desc' } },
          take: 40,
        }),
        this.prisma.userEvent.groupBy({
          by: ['carId'],
          where: { userId, carId: { not: null } },
          _count: true,
        }),
      ]);

    const topCarIds = segmentGroups
      .map((g) => g.carId)
      .filter((id): id is string => id != null);
    const topCarsData = await this.prisma.car.findMany({
      where: { id: { in: topCarIds } },
      select: { id: true, brand: true, model: true, segment: true },
    });
    const carSegMap = new Map(
      topCarsData.map((c) => [c.id, c.segment ?? '']),
    );
    const bySegment = new Map<string, number>();
    for (const g of segmentGroups) {
      if (!g.carId) continue;
      const seg = carSegMap.get(g.carId) || 'unknown';
      bySegment.set(seg, (bySegment.get(seg) ?? 0) + g._count);
    }
    const topInteractedSegments = [...bySegment.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([segment, count]) => ({ segment, count }));

    const topInteractedCars = segmentGroups.slice(0, 12).map((g) => {
      const c = topCarsData.find((x) => x.id === g.carId);
      return {
        carId: g.carId,
        interactions: g._count,
        car: c ?? null,
      };
    });

    return {
      recentEvents,
      preferenceSignal,
      topInteractedSegments,
      topInteractedCars,
      totalInteractions:
        carGroups.reduce((s, g) => s + g._count, 0) ?? 0,
    };
  }
}
