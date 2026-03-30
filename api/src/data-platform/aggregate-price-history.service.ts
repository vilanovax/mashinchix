import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AggRow = {
  carId: string;
  day: Date;
  avgPrice: Prisma.Decimal;
  cnt: bigint;
};

/**
 * از روی car_listings تجمیع روزانه: میانگین قیمت و تعداد آگهی → PriceHistory
 * تاریخ روز از COALESCE(listed_at, scraped_at) گرفته می‌شود.
 */
@Injectable()
export class AggregatePriceHistoryService {
  private readonly logger = new Logger(AggregatePriceHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async aggregateFromListings(options?: {
    /** فقط لیستینگ‌های بعد از این تاریخ */
    since?: Date;
  }): Promise<{ daysUpserted: number }> {
    const since =
      options?.since ??
      new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<AggRow[]>`
      SELECT
        l."carId" AS "carId",
        (date_trunc('day', COALESCE(l."listedAt", l."scrapedAt")))::date AS day,
        AVG(l."price") AS "avgPrice",
        COUNT(*)::bigint AS cnt
      FROM "CarListing" l
      WHERE l."carId" IS NOT NULL
        AND l."isExcluded" = false
        AND COALESCE(l."listedAt", l."scrapedAt") >= ${since}
      GROUP BY l."carId", (date_trunc('day', COALESCE(l."listedAt", l."scrapedAt")))::date
    `;

    let daysUpserted = 0;
    for (const r of rows) {
      const price = new Prisma.Decimal(String(r.avgPrice));
      const listingCount = Number(r.cnt);
      await this.prisma.priceHistory.upsert({
        where: {
          carId_date: {
            carId: r.carId,
            date: r.day,
          },
        },
        create: {
          carId: r.carId,
          date: r.day,
          price,
          listingCount: Number.isFinite(listingCount) ? listingCount : null,
        },
        update: {
          price,
          listingCount: Number.isFinite(listingCount) ? listingCount : null,
        },
      });
      daysUpserted += 1;
    }

    this.logger.log(`Price history upserted rows: ${daysUpserted}`);
    return { daysUpserted };
  }
}
