import { Injectable, Logger } from '@nestjs/common';
import {
  InsightType,
  MarketCycleType,
  PersonalizedInsightType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class PersonalizedInsightsService {
  private readonly logger = new Logger(PersonalizedInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generatePersonalizedInsights(): Promise<{ created: number }> {
    const day = startOfUtcDay(new Date());

    await this.prisma.personalizedInsight.deleteMany({
      where: { createdAt: { gte: day } },
    });

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { watchlistCars: { some: {} } },
          { profile: { isNot: null } },
          { preferenceSignals: { some: {} } },
        ],
      },
      include: {
        profile: true,
        watchlistCars: {
          include: {
            car: {
              include: { marketData: true, scores: true },
            },
          },
        },
        preferenceSignals: {
          orderBy: { signalDate: 'desc' },
          take: 1,
        },
      },
    });

    const rows: Prisma.PersonalizedInsightCreateManyInput[] = [];
    const push = (
      userId: string,
      insightType: PersonalizedInsightType,
      title: string,
      description: string,
      score: number,
      carId?: string,
      segment?: string,
      metadata?: Prisma.InputJsonValue,
    ) => {
      rows.push({
        userId,
        insightType,
        title,
        description,
        score: Math.max(0, Math.min(100, score)),
        carId,
        segment,
        metadata: metadata ?? Prisma.JsonNull,
      });
    };

    const latestPrefSeg = new Map<string, string[]>();
    for (const u of users) {
      const sig = u.preferenceSignals[0];
      if (sig?.preferredSegments?.length) {
        latestPrefSeg.set(u.id, sig.preferredSegments);
      } else if (u.profile?.preferredSegments?.length) {
        latestPrefSeg.set(u.id, u.profile.preferredSegments);
      }
    }

    for (const u of users) {
      const budget = u.budget != null ? toNumber(u.budget) : null;
      const segs = latestPrefSeg.get(u.id) ?? [];

      for (const seg of segs) {
        const cycle = await this.prisma.marketCycle.findFirst({
          where: {
            segment: seg,
            snapshotDate: day,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (cycle?.cycleType === MarketCycleType.BULL) {
          push(
            u.id,
            PersonalizedInsightType.FAVORITE_SEGMENT_REGIME,
            `سگمنت دلخواه شما: فاز صعودی`,
            `سگمنت «${seg}» امروز در مدل چرخه به‌صورت گاوی طبقه‌بندی شده است.`,
            (cycle.confidenceScore ?? 55) * 0.9,
            undefined,
            seg,
            { cycleType: cycle.cycleType },
          );
        }
      }

      for (const w of u.watchlistCars) {
        const c = w.car;
        const avg = c.marketData ? toNumber(c.marketData.avgPrice) : null;
        const ch = c.marketData ? toNumber(c.marketData.priceChange30d) : null;
        if (avg != null && ch != null) {
          push(
            u.id,
            PersonalizedInsightType.WATCHLIST_PRICE_CONTEXT,
            `خودروی رصدشده: ${c.brand} ${c.model}`,
            ch < 0
              ? `قیمت میانگین در ۳۰ روز اخیر رو به کاهش است (~${(ch * 100).toFixed(1)}٪).`
              : `قیمت میانگین در ۳۰ روز اخیر مثبت است (~${(ch * 100).toFixed(1)}٪).`,
            55 + Math.min(35, Math.abs(ch) * 400),
            c.id,
            c.segment ?? undefined,
            { avgPrice: avg, priceChange30d: ch },
          );
        }
      }

      for (const seg of segs) {
        const peer = await this.prisma.carMarketData.findFirst({
          where: {
            car: { segment: seg },
            priceChange30d: { gte: 0.05 },
          },
          orderBy: { priceChange30d: 'desc' },
          include: {
            car: {
              select: { id: true, brand: true, model: true, segment: true },
            },
          },
        });
        if (peer?.car) {
          const ch = toNumber(peer.priceChange30d) ?? 0;
          push(
            u.id,
            PersonalizedInsightType.SEGMENT_PEERS_MOMENTUM,
            `حرکت قیمت در سگمنت «${seg}»`,
            `نمونه‌ای از بازار: ${peer.car.brand} ${peer.car.model} با رشد قیمت ~${(ch * 100).toFixed(0)}٪ در ۳۰ روز (تجمیع).`,
            50 + Math.min(40, ch * 350),
            peer.car.id,
            seg,
            { priceChange30d: ch },
          );
        }
      }

      if (budget != null && budget > 0) {
        const picks = await this.prisma.car.findMany({
          where: {
            segment: segs.length ? { in: segs } : undefined,
            marketData: {
              is: {
                avgPrice: { lte: budget * 1.05, gte: budget * 0.35 },
              },
            },
            scores: {
              is: { riskScore: { lte: 45, not: null } },
            },
          },
          orderBy: { scores: { overallScore: 'desc' } },
          take: 1,
          include: {
            scores: { select: { riskScore: true, overallScore: true } },
            marketData: { select: { avgPrice: true } },
          },
        });
        const pick = picks[0];
        if (pick?.scores) {
          push(
            u.id,
            PersonalizedInsightType.LOW_RISK_IN_BUDGET,
            `گزینهٔ کم‌ریسک نزدیک بودجه`,
            `${pick.brand} ${pick.model}: ریسک پایین‌تر در محدودهٔ بودجهٔ شما (نیازمند تأیید دستی).`,
            58,
            pick.id,
            pick.segment ?? undefined,
            {
              risk: pick.scores.riskScore,
              overall: pick.scores.overallScore,
              avgPrice: toNumber(pick.marketData?.avgPrice),
              budget,
            },
          );
        }
      }

      const opp = await this.prisma.marketInsight.findFirst({
        where: {
          insightType: InsightType.BEST_INVESTMENT_OPPORTUNITY,
          snapshotDate: day,
          car: segs.length
            ? { segment: { in: segs } }
            : undefined,
        },
        orderBy: { score: 'desc' },
        include: {
          car: {
            select: { id: true, brand: true, model: true, segment: true },
          },
        },
      });
      if (opp?.car) {
        push(
          u.id,
          PersonalizedInsightType.PROFILE_INVESTMENT_MATCH,
          `فرصت سرمایه‌گذاری مطابق پروفایل`,
          `${opp.car.brand} ${opp.car.model}: ${opp.description.slice(0, 180)}`,
          opp.score,
          opp.car.id,
          opp.segment ?? opp.car.segment ?? undefined,
          { sourceInsightId: opp.id },
        );
      }

      const b = await this.prisma.carBehaviorMetricsDaily.findFirst({
        where: { carId: { in: u.watchlistCars.map((w) => w.carId) } },
        orderBy: { snapshotDate: 'desc' },
      });
      if (b && (b.detailViews ?? 0) >= 3) {
        push(
          u.id,
          PersonalizedInsightType.RECENT_BEHAVIOR_NUDGE,
          `فعالیت اخیر در جزئیات خودرو`,
          `بازدید از جزئیات خودرو در بازهٔ اخیر بالاست؛ می‌توانید سیگنال‌های بازار را برای همان مدل چک کنید.`,
          40,
          b.carId,
          undefined,
          { detailViews: b.detailViews },
        );
      }
    }

    if (rows.length) {
      await this.prisma.personalizedInsight.createMany({ data: rows });
    }
    this.logger.log(`Personalized insights: ${rows.length} rows`);
    return { created: rows.length };
  }
}
