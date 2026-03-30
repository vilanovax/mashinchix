import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ListingSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDivarPostListResponse } from './divar.parser';
import { NormalizedCarListing } from './divar.types';
import { ListingMatcherService } from '../../data-platform/listing-matcher.service';
import { Prisma } from '@prisma/client';

/** بدنهٔ پیش‌فرض جستجوی «خودرو» — با DIVAR_SEARCH_JSON در .env بازنویسی کامل می‌شود. */
const DEFAULT_SEARCH_BODY: Record<string, unknown> = {
  city_ids: ['1'],
  pagination_data: {},
  search_data: {
    form_data: {
      data: {
        category: {
          slug: 'light',
        },
      },
    },
  },
};

@Injectable()
export class DivarScraperService {
  private readonly logger = new Logger(DivarScraperService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly matcher: ListingMatcherService,
  ) {}

  /**
   * دریافت آگهی‌ها از دیوار، مچ با Car در DB، upsert در car_listings.
   * در صورت خطای شبکه یا تغییر API، لاگ می‌کند و صفر آگهی برنمی‌گرداند الزاماً — تعداد ذخیره‌شده را برمی‌گرداند.
   */
  async scrapeAndPersist(options?: {
    /** تعداد نهایی آگهی‌هایی که پارس شدند (قبل از ذخیره) */
    maxListings?: number;
  }): Promise<{ fetched: number; saved: number }> {
    const url =
      this.config.get<string>('DIVAR_SEARCH_URL') ??
      'https://api.divar.ir/v8/postlist/w/search';

    const body = this.resolveSearchBody();
    const timeout =
      this.config.get<number>('DIVAR_REQUEST_TIMEOUT_MS') ?? 25_000;
    const priceDivisor =
      this.config.get<number>('DIVAR_PRICE_DIVISOR') ?? 1;

    let root: unknown;
    try {
      const res = await axios.post(url, body, {
        timeout,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent':
            this.config.get<string>('DIVAR_USER_AGENT') ??
            'Mozilla/5.0 (compatible; MashinchiBot/0.1)',
          Referer: 'https://divar.ir/',
        },
        validateStatus: () => true,
      });

      if (res.status < 200 || res.status >= 300) {
        this.logger.warn(
          `Divar HTTP ${res.status}: ${JSON.stringify(res.data)?.slice(0, 500)}`,
        );
        return { fetched: 0, saved: 0 };
      }
      root = res.data;
    } catch (e) {
      const err = e as AxiosError;
      this.logger.error(
        `Divar request failed: ${err.message}`,
        err.stack,
      );
      return { fetched: 0, saved: 0 };
    }

    let normalized = parseDivarPostListResponse(root);
    if (options?.maxListings) {
      normalized = normalized.slice(0, options.maxListings);
    }

    if (priceDivisor !== 1) {
      normalized = normalized.map((n) => ({
        ...n,
        priceTomans: Math.round(n.priceTomans / priceDivisor),
      }));
    }

    const [cars, aliases] = await Promise.all([
      this.matcher.loadCarsForMatching(),
      this.matcher.loadActiveAliases(),
    ]);
    let saved = 0;
    const now = new Date();

    for (const n of normalized) {
      const title = [n.title, n.description].filter(Boolean).join(' | ');
      const carId = this.matcher.matchCarId(
        title,
        ListingSource.DIVAR,
        cars,
        aliases,
      );

      await this.prisma.carListing.upsert({
        where: {
          source_externalId: {
            source: ListingSource.DIVAR,
            externalId: n.externalId,
          },
        },
        create: {
          source: ListingSource.DIVAR,
          externalId: n.externalId,
          carId,
          price: new Prisma.Decimal(n.priceTomans),
          mileageKm: n.mileageKm,
          yearModel: n.yearModel,
          city: n.city,
          title: n.title,
          description: n.description,
          listingUrl: n.listingUrl,
          listedAt: n.listedAt ?? now,
          scrapedAt: now,
          lastSeenAt: now,
          rawPayload: n.raw as Prisma.InputJsonValue,
        },
        update: {
          carId,
          price: new Prisma.Decimal(n.priceTomans),
          mileageKm: n.mileageKm,
          yearModel: n.yearModel,
          city: n.city,
          title: n.title,
          description: n.description,
          listingUrl: n.listingUrl,
          listedAt: n.listedAt ?? now,
          scrapedAt: now,
          lastSeenAt: now,
          rawPayload: n.raw as Prisma.InputJsonValue,
        },
      });
      saved += 1;
    }

    this.logger.log(`Divar: parsed ${normalized.length}, upserted ${saved}`);
    return { fetched: normalized.length, saved };
  }

  private resolveSearchBody(): Record<string, unknown> {
    const raw = this.config.get<string>('DIVAR_SEARCH_JSON');
    if (raw) {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        this.logger.warn('DIVAR_SEARCH_JSON invalid JSON — using default body');
      }
    }
    return { ...DEFAULT_SEARCH_BODY };
  }
}
