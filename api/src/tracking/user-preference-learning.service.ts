import { Injectable, Logger } from '@nestjs/common';
import { UserEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { utcDayBounds } from './tracking-date.util';

const METHODOLOGY = 'heuristic-v1';

function eventWeight(type: UserEventType): number {
  switch (type) {
    case UserEventType.CAR_DETAIL_VIEW:
      return 1;
    case UserEventType.RECOMMENDATION_VIEW:
      return 0.6;
    case UserEventType.RECOMMENDATION_CLICK:
      return 3;
    case UserEventType.WISHLIST_ADD:
      return 4;
    case UserEventType.WISHLIST_REMOVE:
      return -0.5;
    case UserEventType.RECOMMENDATION_DISMISS:
      return -1;
    case UserEventType.MARKET_SIGNAL_VIEW:
      return 0.8;
    case UserEventType.COMPARE_ADD:
      return 1.2;
    default:
      return 0.35;
  }
}

@Injectable()
export class UserPreferenceLearningService {
  private readonly logger = new Logger(UserPreferenceLearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** استنتاج ترجیح از ۹۰ روز اخیر؛ ردیف امروز (UTC) را upsert می‌کند. */
  async recomputeForUser(userId: string): Promise<void> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);

    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        carId: { not: null },
      },
      select: { carId: true, eventType: true },
    });

    if (events.length === 0) {
      return;
    }

    const carWeight = new Map<string, number>();
    for (const e of events) {
      if (!e.carId) continue;
      const w = (carWeight.get(e.carId) ?? 0) + eventWeight(e.eventType);
      carWeight.set(e.carId, w);
    }

    const sortedCars = [...carWeight.entries()]
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    if (sortedCars.length === 0) {
      return;
    }

    const topCarIds = sortedCars.map(([id]) => id);
    const cars = await this.prisma.car.findMany({
      where: { id: { in: topCarIds } },
      include: { scores: true },
    });

    const segCounts = new Map<string, number>();
    let wRisk = 0;
    let wOwn = 0;
    let wInv = 0;
    let wPerf = 0;
    let wSum = 0;

    for (const car of cars) {
      const wt = Math.max(0.5, carWeight.get(car.id) ?? 1);
      const seg = car.segment?.trim() || 'unknown';
      segCounts.set(seg, (segCounts.get(seg) ?? 0) + wt);
      const s = car.scores;
      if (s) {
        wRisk += (s.riskScore ?? 50) * wt;
        wOwn += (s.ownershipScore ?? 50) * wt;
        wInv += (s.investmentScore ?? 50) * wt;
        wPerf += (s.performanceScore ?? 50) * wt;
        wSum += wt;
      }
    }

    const preferredSegments = [...segCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s]) => s);

    const avgRisk = wSum > 0 ? wRisk / wSum : 50;
    const avgOwn = wSum > 0 ? wOwn / wSum : 50;
    const avgInv = wSum > 0 ? wInv / wSum : 50;
    const avgPerf = wSum > 0 ? wPerf / wSum : 50;

    const inferredWeights: Record<string, number> = {
      economy: avgRisk < 45 ? 1.12 : 1,
      reliability: avgRisk < 44 ? 1.1 : 1,
      performance: avgPerf > 64 ? 1.15 : 1,
      investment: avgInv > 63 ? 1.18 : avgInv < 48 ? 0.92 : 1,
      ownership:
        avgOwn < 48 ? 1.08 : avgOwn > 60 ? 0.95 : 1,
    };

    const confidenceScore = Math.min(
      1,
      0.32 + events.length * 0.006 + sortedCars.length * 0.018,
    );

    const { snapshot } = utcDayBounds(new Date());

    await this.prisma.userPreferenceSignal.upsert({
      where: {
        userId_signalDate: { userId, signalDate: snapshot },
      },
      create: {
        userId,
        signalDate: snapshot,
        preferredSegments,
        inferredWeights,
        favoriteCarIds: topCarIds.slice(0, 10),
        confidenceScore,
        methodology: METHODOLOGY,
      },
      update: {
        preferredSegments,
        inferredWeights,
        favoriteCarIds: topCarIds.slice(0, 10),
        confidenceScore,
        methodology: METHODOLOGY,
      },
    });
  }

  /** تمام کاربرانی که در بازهٔ اخیر رویداد داشته‌اند */
  async recomputeAllActiveUsers(): Promise<{ users: number }> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 120);

    const rows = await this.prisma.userEvent.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: { gte: since },
      },
      _count: true,
    });

    let n = 0;
    for (const r of rows) {
      if (r.userId) {
        await this.recomputeForUser(r.userId);
        n += 1;
      }
    }

    this.logger.log(`UserPreferenceSignal recompute: ${n} users`);
    return { users: n };
  }
}
