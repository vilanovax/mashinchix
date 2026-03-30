import { Injectable, Logger } from '@nestjs/common';
import { UserEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseOptionalDay, utcDayBounds } from './tracking-date.util';

type CarAgg = {
  detailViews: number;
  recommendationViews: number;
  recommendationClicks: number;
  recommendationDismisses: number;
  wishlistAdds: number;
  compareAdds: number;
  marketSignalViews: number;
  sellerClicks: number;
};

const EMPTY_AGG: CarAgg = {
  detailViews: 0,
  recommendationViews: 0,
  recommendationClicks: 0,
  recommendationDismisses: 0,
  wishlistAdds: 0,
  compareAdds: 0,
  marketSignalViews: 0,
  sellerClicks: 0,
};

function bump(agg: CarAgg, type: UserEventType, n: number): void {
  switch (type) {
    case UserEventType.CAR_DETAIL_VIEW:
      agg.detailViews += n;
      break;
    case UserEventType.RECOMMENDATION_VIEW:
      agg.recommendationViews += n;
      break;
    case UserEventType.RECOMMENDATION_CLICK:
      agg.recommendationClicks += n;
      break;
    case UserEventType.RECOMMENDATION_DISMISS:
      agg.recommendationDismisses += n;
      break;
    case UserEventType.WISHLIST_ADD:
      agg.wishlistAdds += n;
      break;
    case UserEventType.COMPARE_ADD:
      agg.compareAdds += n;
      break;
    case UserEventType.MARKET_SIGNAL_VIEW:
      agg.marketSignalViews += n;
      break;
    case UserEventType.CONTACT_SELLER_CLICK:
      agg.sellerClicks += n;
      break;
    default:
      break;
  }
}

@Injectable()
export class BehaviorMetricsService {
  private readonly logger = new Logger(BehaviorMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * بازمحاسبهٔ idempotent برای یک روز UTC؛ ردیف‌ها را با (carId, snapshotDate) upsert می‌کند.
   */
  async recomputeDaily(dateInput?: string): Promise<{
    snapshotDate: string;
    carsUpdated: number;
  }> {
    const { start, end, snapshot } = utcDayBounds(parseOptionalDay(dateInput));
    const snapshotDateStr = snapshot.toISOString().slice(0, 10);

    const byCar = new Map<string, CarAgg>();

    const eventGroups = await this.prisma.userEvent.groupBy({
      by: ['carId', 'eventType'],
      where: {
        createdAt: { gte: start, lt: end },
        carId: { not: null },
      },
      _count: { _all: true },
    });

    for (const row of eventGroups) {
      if (!row.carId) continue;
      let agg = byCar.get(row.carId);
      if (!agg) {
        agg = { ...EMPTY_AGG };
        byCar.set(row.carId, agg);
      }
      bump(agg, row.eventType, row._count._all);
    }

    const sessionImpressions =
      await this.prisma.recommendationResult.groupBy({
        by: ['carId'],
        where: {
          recommendationSession: { createdAt: { gte: start, lt: end } },
        },
        _count: { _all: true },
      });

    for (const row of sessionImpressions) {
      let agg = byCar.get(row.carId);
      if (!agg) {
        agg = { ...EMPTY_AGG };
        byCar.set(row.carId, agg);
      }
      agg.recommendationViews += row._count._all;
    }

    let carsUpdated = 0;
    for (const [carId, agg] of byCar) {
      const views = agg.recommendationViews;
      const ctr =
        views > 0 ? agg.recommendationClicks / views : null;
      const saveRate = views > 0 ? agg.wishlistAdds / views : null;
      const dismissRate =
        views > 0 ? agg.recommendationDismisses / views : null;

      await this.prisma.carBehaviorMetricsDaily.upsert({
        where: {
          carId_snapshotDate: { carId, snapshotDate: snapshot },
        },
        create: {
          carId,
          snapshotDate: snapshot,
          detailViews: agg.detailViews,
          recommendationViews: agg.recommendationViews,
          recommendationClicks: agg.recommendationClicks,
          recommendationDismisses: agg.recommendationDismisses,
          wishlistAdds: agg.wishlistAdds,
          compareAdds: agg.compareAdds,
          marketSignalViews: agg.marketSignalViews,
          sellerClicks: agg.sellerClicks,
          ctrRecommendation: ctr ?? undefined,
          saveRate: saveRate ?? undefined,
          dismissRate: dismissRate ?? undefined,
        },
        update: {
          detailViews: agg.detailViews,
          recommendationViews: agg.recommendationViews,
          recommendationClicks: agg.recommendationClicks,
          recommendationDismisses: agg.recommendationDismisses,
          wishlistAdds: agg.wishlistAdds,
          compareAdds: agg.compareAdds,
          marketSignalViews: agg.marketSignalViews,
          sellerClicks: agg.sellerClicks,
          ctrRecommendation: ctr ?? undefined,
          saveRate: saveRate ?? undefined,
          dismissRate: dismissRate ?? undefined,
        },
      });
      carsUpdated += 1;
    }

    this.logger.log(
      `behavior metrics daily ${snapshotDateStr}: ${carsUpdated} cars`,
    );

    return { snapshotDate: snapshotDateStr, carsUpdated };
  }
}
