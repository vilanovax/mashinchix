import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserNotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

const DEDUP_HOURS = 36;

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function subHours(d: Date, h: number): Date {
  return new Date(d.getTime() - h * 3600_000);
}

@Injectable()
export class UserNotificationService {
  private readonly logger = new Logger(UserNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateNotifications(): Promise<{ created: number }> {
    const now = new Date();
    const since = subHours(now, DEDUP_HOURS);

    const entries = await this.prisma.userWatchlist.findMany({
      include: {
        user: { select: { id: true, name: true } },
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            segment: true,
            marketData: true,
            scores: true,
          },
        },
      },
    });

    const rows: Prisma.UserNotificationCreateManyInput[] = [];
    const batchKey = new Set<string>();

    const push = (input: {
      userId: string;
      type: UserNotificationType;
      title: string;
      message: string;
      carId?: string;
      segment?: string;
      metadata?: Prisma.InputJsonValue;
    }) => {
      const k = `${input.userId}:${input.type}:${input.carId ?? ''}`;
      if (batchKey.has(k)) return;
      batchKey.add(k);
      rows.push({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        carId: input.carId,
        segment: input.segment,
        metadata: input.metadata ?? Prisma.JsonNull,
        isRead: false,
      });
    };

    for (const w of entries) {
      const car = w.car;
      const md = car.marketData;
      const sc = car.scores;
      const label = `${car.brand} ${car.model} ${car.year}`;
      const avg = md ? toNumber(md.avgPrice) : null;
      const ch30 = md ? toNumber(md.priceChange30d) : null;
      const signal = md?.marketSignal?.toUpperCase() ?? null;
      const mom = md?.momentumScore ?? null;
      const risk = sc?.riskScore ?? null;

      const can = async (
        type: UserNotificationType,
        carId: string | undefined,
      ) =>
        !(await this.prisma.userNotification.findFirst({
          where: {
            userId: w.userId,
            type,
            ...(carId ? { carId } : {}),
            createdAt: { gte: since },
          },
        }));

      if (w.alertOnPriceDrop) {
        const targetBuy = toNumber(w.targetBuyPrice);
        const hitTarget =
          targetBuy != null && avg != null && avg <= targetBuy;
        const marketDrop = ch30 != null && ch30 <= -0.04;
        if ((hitTarget || marketDrop) && (await can(UserNotificationType.PRICE_DROP, car.id))) {
          push({
            userId: w.userId,
            type: UserNotificationType.PRICE_DROP,
            title: 'افت قیمت در خودروی رصدشده',
            message: hitTarget
              ? `${label}: قیمت میانگین به زیر هدف خرید شما رسید (تقریبی).`
              : `${label}: روند ۳۰ روزه قیمت منفی است.`,
            carId: car.id,
            metadata: { avgPrice: avg, targetBuy, ch30 },
          });
        }
      }

      if (w.alertOnPriceRise && ch30 != null && ch30 >= 0.04) {
        if (await can(UserNotificationType.PRICE_RISE, car.id)) {
          push({
            userId: w.userId,
            type: UserNotificationType.PRICE_RISE,
            title: 'رشد قیمت در خودروی رصدشده',
            message: `${label}: مومنتوم قیمت در ۳۰ روز اخیر مثبت است.`,
            carId: car.id,
            metadata: { ch30 },
          });
        }
      }

      if (w.alertOnBuySignal && signal === 'BUY') {
        if (await can(UserNotificationType.BUY_SIGNAL, car.id)) {
          push({
            userId: w.userId,
            type: UserNotificationType.BUY_SIGNAL,
            title: 'سیگنال خرید',
            message: `${label}: مدل سیگنال بازار در وضعیت BUY است.`,
            carId: car.id,
            metadata: { marketSignal: signal },
          });
        }
      }

      if (w.alertOnSellSignal && signal === 'SELL') {
        if (await can(UserNotificationType.SELL_SIGNAL, car.id)) {
          push({
            userId: w.userId,
            type: UserNotificationType.SELL_SIGNAL,
            title: 'سیگنال فروش',
            message: `${label}: مدل سیگنال بازار در وضعیت SELL است.`,
            carId: car.id,
            metadata: { marketSignal: signal },
          });
        }
      }

      if (w.alertOnHighRisk && risk != null && risk >= 62) {
        if (await can(UserNotificationType.HIGH_RISK, car.id)) {
          push({
            userId: w.userId,
            type: UserNotificationType.HIGH_RISK,
            title: 'ریسک بالاتر',
            message: `${label}: امتیاز ریسک مدل بالا است.`,
            carId: car.id,
            metadata: { riskScore: risk },
          });
        }
      }

      if (w.alertOnMomentum && mom != null && mom >= 72) {
        if (await can(UserNotificationType.INSIGHT, car.id)) {
          push({
            userId: w.userId,
            type: UserNotificationType.INSIGHT,
            title: 'مومنتوم قوی',
            message: `${label}: مومنتوم قیمت در مدل بالاست.`,
            carId: car.id,
            metadata: { momentumScore: mom, channel: 'momentum' },
          });
        }
      }

      const todayInsight = await this.prisma.marketInsight.findFirst({
        where: {
          carId: car.id,
          snapshotDate: startOfUtcDay(now),
        },
        orderBy: { score: 'desc' },
      });
      if (todayInsight && (await can(UserNotificationType.INSIGHT, car.id))) {
        push({
          userId: w.userId,
          type: UserNotificationType.INSIGHT,
          title: 'بینش بازار برای خودروی شما',
          message: `${label}: ${todayInsight.title}`,
          carId: car.id,
          metadata: {
            insightType: todayInsight.insightType,
            insightId: todayInsight.id,
          },
        });
      }

      const recentAlert = await this.prisma.marketAlert.findFirst({
        where: {
          carId: car.id,
          isActive: true,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentAlert && (await can(UserNotificationType.MARKET_ALERT, car.id))) {
        push({
          userId: w.userId,
          type: UserNotificationType.MARKET_ALERT,
          title: 'هشدار بازار',
          message: `${label}: ${recentAlert.message}`,
          carId: car.id,
          segment: recentAlert.segment ?? undefined,
          metadata: { alertType: recentAlert.alertType },
        });
      }
    }

    if (rows.length) {
      await this.prisma.userNotification.createMany({ data: rows });
    }
    this.logger.log(`User notifications: ${rows.length} rows`);
    return { created: rows.length };
  }

  /** بعد از ذخیرهٔ گزارش روزانه — برای کاربرانی که لیست رصد دارند. */
  async notifyDailyMarketReport(reportId: string): Promise<{ created: number }> {
    const report = await this.prisma.marketReport.findUnique({
      where: { id: reportId },
    });
    if (!report) return { created: 0 };

    const day = startOfUtcDay(new Date());
    const holders = await this.prisma.userWatchlist.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    const batch: Prisma.UserNotificationCreateManyInput[] = [];
    for (const { userId } of holders) {
      const dupe = await this.prisma.userNotification.findFirst({
        where: {
          userId,
          type: UserNotificationType.MARKET_REPORT,
          createdAt: { gte: day },
        },
      });
      if (dupe) continue;
      batch.push({
        userId,
        type: UserNotificationType.MARKET_REPORT,
        title: 'گزارش روزانه بازار آماده است',
        message: report.summary.slice(0, 900),
        metadata: { reportId: report.id, reportDate: report.reportDate } as Prisma.InputJsonValue,
        isRead: false,
      });
    }

    if (batch.length) {
      await this.prisma.userNotification.createMany({ data: batch });
    }
    this.logger.log(`Market report notifications: ${batch.length}`);
    return { created: batch.length };
  }
}
