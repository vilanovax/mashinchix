import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import {
  QueryRankingsDto,
  RankingSort,
} from '../cars/dto/query-rankings.dto';

export const RANKING_CATEGORIES = [
  'best-overall',
  'best-economic',
  'best-family',
  'best-investment',
  'lowest-risk',
  'most-reliable',
  'lowest-depreciation',
] as const;

export type RankingCategory = (typeof RANKING_CATEGORIES)[number];

export const sortFieldMap = {
  overall: 'overallScore',
  performance: 'performanceScore',
  comfort: 'comfortScore',
  economy: 'economyScore',
  reliability: 'reliabilityScore',
  market: 'marketScore',
  ownership: 'ownershipScore',
  prestige: 'prestigeScore',
  risk: 'riskScore',
} as const;

@Injectable()
export class CarRankingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** رنکینگ بر اساس دستهٔ از پیش تعریف‌شده (ترکیب امتیازها / ریسک / بازار) */
  async getCategoryRankings(
    category: string,
    limit = 50,
    segment?: string,
  ) {
    if (
      !(RANKING_CATEGORIES as readonly string[]).includes(category)
    ) {
      throw new BadRequestException(
        `دستهٔ نامعتبر: «${category}». مقادیر مجاز: ${RANKING_CATEGORIES.join(', ')}`,
      );
    }
    const cat = category as RankingCategory;

    const where: Prisma.CarWhereInput = {
      scores: { isNot: null },
    };
    if (segment) {
      where.segment = { contains: segment };
    }

    const cars = await this.prisma.car.findMany({
      where,
      include: {
        scores: true,
        marketData: true,
      },
    });

    type Scored = (typeof cars)[number];

    const sortKey = (c: Scored): number => {
      const s = c.scores!;
      const md = c.marketData;
      const dep =
        md?.depreciationRate30d != null
          ? toNumber(md.depreciationRate30d)
          : null;
      switch (cat) {
        case 'best-overall':
          return s.overallScore ?? 0;
        case 'best-economic':
          return (
            0.65 * (s.economyScore ?? 0) + 0.35 * (s.ownershipScore ?? 0)
          );
        case 'best-family':
          return (
            0.42 * (s.comfortScore ?? 0) +
            0.33 * (s.reliabilityScore ?? 0) +
            0.25 * (s.marketScore ?? 0)
          );
        case 'best-investment': {
          const risk = s.riskScore ?? 50;
          const depN = dep ?? -0.05;
          return (
            0.38 * (s.marketScore ?? 0) +
            0.34 * (100 - risk) +
            0.28 * (50 + depN * 80)
          );
        }
        case 'lowest-risk':
          return s.riskScore ?? 999;
        case 'most-reliable':
          return s.reliabilityScore ?? -1;
        case 'lowest-depreciation':
          return dep ?? -999;
        default:
          return 0;
      }
    };

    const ascending = cat === 'lowest-risk';
    const ranked = [...cars].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ascending) return ka - kb;
      return kb - ka;
    });

    const take = Math.min(Math.max(1, limit), 200);
    const slice = ranked.slice(0, take);

    return {
      category: cat,
      count: slice.length,
      sortHint: ascending ? 'asc' : 'desc',
      rankings: slice.map((c, index) => ({
        rank: index + 1,
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        segment: c.segment,
        sortScore: Math.round(sortKey(c) * 100) / 100,
        scores: c.scores,
        avgPrice: c.marketData?.avgPrice
          ? toNumber(c.marketData.avgPrice)
          : null,
        depreciationRate30d: c.marketData?.depreciationRate30d
          ? toNumber(c.marketData.depreciationRate30d)
          : null,
      })),
    };
  }

  async getRankings(query: QueryRankingsDto) {
    const sortKey: RankingSort = query.sort ?? 'overall';
    const field = sortFieldMap[sortKey];
    const take = query.limit ?? 50;

    const where: Prisma.CarWhereInput = {
      scores: { isNot: null },
    };
    if (query.segment) {
      where.segment = { contains: query.segment };
    }

    /** برای risk: کم‌ریسک‌تر بالاتر (asc)؛ بقیه: امتیاز بالاتر بهتر (desc) */
    const orderDir = sortKey === 'risk' ? 'asc' : 'desc';
    const cars = await this.prisma.car.findMany({
      where,
      take,
      include: {
        scores: true,
        marketData: true,
      },
      orderBy: {
        scores: { [field]: orderDir },
      },
    });

    return {
      sort: sortKey,
      count: cars.length,
      rankings: cars.map((c, index) => ({
        rank: index + 1,
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        segment: c.segment,
        scores: c.scores,
        avgPrice: c.marketData?.avgPrice
          ? toNumber(c.marketData.avgPrice)
          : null,
      })),
    };
  }
}
