import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function utcSnapshotDate(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0, 0));
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

@Injectable()
export class CarLiquidityStatsService {
  private readonly logger = new Logger(CarLiquidityStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * نقطهٔ روزانه per car: مدت ماند آگهی‌ها (تقریبی) + نرخ فروش/خروج از فایل آگهی
   */
  async recomputeDaily(dateInput?: string): Promise<{
    snapshotDate: string;
    cars: number;
  }> {
    const base =
      dateInput?.trim() ?
        new Date(`${dateInput.trim()}T12:00:00.000Z`)
      : new Date();
    const snapshotDate = utcSnapshotDate(base);
    const staleCut = new Date(Date.now() - 10 * 86400000);

    const cars = await this.prisma.car.findMany({ select: { id: true } });
    let n = 0;
    for (const { id: carId } of cars) {
      const listings = await this.prisma.carListing.findMany({
        where: { carId, isExcluded: false },
        select: { externalId: true, scrapedAt: true, lastSeenAt: true },
      });

      const byExt = new Map<
        string,
        { first: Date; last: Date }
      >();
      for (const L of listings) {
        const t0 = L.scrapedAt;
        const t1 = L.lastSeenAt ?? L.scrapedAt;
        const cur = byExt.get(L.externalId);
        if (!cur) {
          byExt.set(L.externalId, { first: t0, last: t1 });
        } else {
          if (t0 < cur.first) cur.first = t0;
          if (t1 > cur.last) cur.last = t1;
        }
      }

      const dwellDays: number[] = [];
      for (const [, v] of byExt) {
        const days =
          (v.last.getTime() - v.first.getTime()) / 86400000;
        if (
          days >= 1.5 &&
          v.last.getTime() < staleCut.getTime()
        ) {
          dwellDays.push(days);
        }
      }
      dwellDays.sort((a, b) => a - b);
      const medianDays = median(dwellDays);
      const avgDays =
        dwellDays.length > 0 ?
          dwellDays.reduce((a, b) => a + b, 0) / dwellDays.length
        : null;

      const md = await this.prisma.carMarketData.findUnique({
        where: { carId },
        select: {
          listingsLast7d: true,
          listingsLast30d: true,
        },
      });
      let sellThroughRate: number | null = null;
      if (
        md?.listingsLast7d != null &&
        md?.listingsLast30d != null &&
        md.listingsLast30d > 0
      ) {
        sellThroughRate = Math.min(
          1.5,
          md.listingsLast7d / md.listingsLast30d,
        );
      }

      await this.prisma.carLiquidityStats.upsert({
        where: {
          carId_snapshotDate: {
            carId,
            snapshotDate,
          },
        },
        create: {
          carId,
          snapshotDate,
          avgDaysToSell: avgDays ?? undefined,
          medianDaysToSell: medianDays ?? undefined,
          sellThroughRate: sellThroughRate ?? undefined,
        },
        update: {
          avgDaysToSell: avgDays ?? undefined,
          medianDaysToSell: medianDays ?? undefined,
          sellThroughRate: sellThroughRate ?? undefined,
        },
      });
      n += 1;
    }

    const ds = snapshotDate.toISOString().slice(0, 10);
    this.logger.log(`CarLiquidityStats ${ds}: ${n} cars`);
    return { snapshotDate: ds, cars: n };
  }
}
