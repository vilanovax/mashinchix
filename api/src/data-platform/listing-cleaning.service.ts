import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePersianTitle } from '../common/text-normalize';

const MAX_MILEAGE_KM = 800_000;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function iqrBounds(values: number[]): { low: number; high: number } | null {
  if (values.length < 4) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return null;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

type Fingerprint = string;

@Injectable()
export class ListingCleaningService {
  private readonly logger = new Logger(ListingCleaningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ۱) کارکرد نامعتبر  ۲) پرت‌قیمت IQR به‌ازای هر خودرو  ۳) آگهی تکراری (اثر انگشت عنوان+قیمت+کارکرد)
   */
  async run(options?: {
    since?: Date;
    resetExclusions?: boolean;
  }): Promise<{
    invalidMileage: number;
    priceOutliers: number;
    duplicates: number;
  }> {
    const since =
      options?.since ??
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const reset =
      options?.resetExclusions === true ||
      this.config.get<string>('CLEANING_RESET_EXCLUSIONS') === 'true';

    if (reset) {
      const r = await this.prisma.carListing.updateMany({
        where: { scrapedAt: { gte: since } },
        data: { isExcluded: false, exclusionReason: null },
      });
      this.logger.log(`Reset exclusions for ${r.count} listings (since window)`);
    }

    let invalidMileage = 0;
    let priceOutliers = 0;
    let duplicates = 0;

    const mileageRes = await this.prisma.carListing.updateMany({
      where: {
        carId: { not: null },
        scrapedAt: { gte: since },
        isExcluded: false,
        OR: [
          { mileageKm: { lt: 0 } },
          { mileageKm: { gt: MAX_MILEAGE_KM } },
        ],
      },
      data: {
        isExcluded: true,
        exclusionReason: 'INVALID_MILEAGE',
      },
    });
    invalidMileage = mileageRes.count;

    const carsWithListings = await this.prisma.carListing.findMany({
      where: {
        carId: { not: null },
        scrapedAt: { gte: since },
        isExcluded: false,
      },
      distinct: ['carId'],
      select: { carId: true },
    });

    for (const { carId } of carsWithListings) {
      if (!carId) continue;
      const listings = await this.prisma.carListing.findMany({
        where: {
          carId,
          scrapedAt: { gte: since },
          isExcluded: false,
        },
        select: { id: true, price: true },
      });
      const prices = listings.map((l) => l.price.toNumber());
      const bounds = iqrBounds(prices);
      if (!bounds) continue;
      const outIds = listings
        .filter(
          (l) =>
            l.price.toNumber() < bounds.low || l.price.toNumber() > bounds.high,
        )
        .map((l) => l.id);
      if (outIds.length > 0) {
        const u = await this.prisma.carListing.updateMany({
          where: { id: { in: outIds } },
          data: {
            isExcluded: true,
            exclusionReason: 'PRICE_OUTLIER_IQR',
          },
        });
        priceOutliers += u.count;
      }
    }

    for (const { carId } of carsWithListings) {
      if (!carId) continue;
      const batch = await this.prisma.carListing.findMany({
        where: {
          carId,
          scrapedAt: { gte: since },
          isExcluded: false,
        },
        orderBy: { scrapedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          mileageKm: true,
          scrapedAt: true,
        },
      });

      const seen = new Map<Fingerprint, string>();
      const dupIds: string[] = [];

      for (const row of batch) {
        const fp = this.fingerprint(row);
        const keeper = seen.get(fp);
        if (keeper) {
          dupIds.push(row.id);
        } else {
          seen.set(fp, row.id);
        }
      }

      if (dupIds.length > 0) {
        const u = await this.prisma.carListing.updateMany({
          where: { id: { in: dupIds } },
          data: {
            isExcluded: true,
            exclusionReason: 'DUPLICATE_FINGERPRINT',
          },
        });
        duplicates += u.count;
      }
    }

    this.logger.log(
      `Cleaning: invalidMileage=${invalidMileage}, outliers=${priceOutliers}, duplicates=${duplicates}`,
    );

    return { invalidMileage, priceOutliers, duplicates };
  }

  private fingerprint(row: {
    title: string | null;
    description: string | null;
    price: { toNumber: () => number };
    mileageKm: number | null;
  }): Fingerprint {
    const t = normalizePersianTitle(
      [row.title, row.description].filter(Boolean).join('|').slice(0, 200),
    );
    const p = Math.round(row.price.toNumber() / 500_000);
    const m = row.mileageKm ?? -1;
    return `${t}|${p}|${m}`;
  }
}
