import { Injectable, Logger } from '@nestjs/common';
import {
  AlertSeverity,
  MarketAlertType,
  MarketCycleType,
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
export class MarketAlertsService {
  private readonly logger = new Logger(MarketAlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * هشدارهای تازه؛ هشدارهای فعال قبلی غیرفعال می‌شوند تا آخرین دسته مرجع باشد.
   */
  async generateAlerts(): Promise<{ created: number }> {
    await this.prisma.marketAlert.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const cars = await this.prisma.car.findMany({
      include: {
        marketData: true,
        scores: true,
        pricePrediction: true,
      },
    });

    const liquidityLatest = await this.loadLatestLiquidityByCar();

    const alerts: Prisma.MarketAlertCreateManyInput[] = [];

    const push = (
      alertType: MarketAlertType,
      opts: {
        carId?: string;
        segment?: string;
        message: string;
        severity: AlertSeverity;
        metadata?: Prisma.InputJsonValue;
      },
    ) => {
      alerts.push({
        alertType,
        carId: opts.carId,
        segment: opts.segment,
        message: opts.message,
        severity: opts.severity,
        metadata: opts.metadata ?? Prisma.JsonNull,
        isActive: true,
      });
    };

    for (const c of cars) {
      const ch = toNumber(c.marketData?.priceChange30d);
      if (ch != null && ch <= -0.06) {
        push(MarketAlertType.PRICE_DROP, {
          carId: c.id,
          message: `${c.brand} ${c.model}: قیمت میانگین ~${(ch * 100).toFixed(1)}٪ در ۳۰ روز اخیر (تقریبی).`,
          severity: ch <= -0.12 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          metadata: { priceChange30d: ch },
        });
      }

      const vol = c.marketData?.volatilityScore;
      if (vol != null && vol <= 22) {
        push(MarketAlertType.VOLATILITY_SPIKE, {
          carId: c.id,
          message: `${c.brand} ${c.model}: نوسان قیمت بالا (پایداری پایین در مدل).`,
          severity: vol <= 15 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          metadata: { volatilityScore: vol },
        });
      }

      const liq = liquidityLatest.get(c.id)?.avgDaysToSell;
      const liqScore = c.marketData?.liquidityScore;
      if (
        (liq != null && liq >= 45) ||
        (liqScore != null && liqScore <= 28)
      ) {
        push(MarketAlertType.CAR_ILLIQUID, {
          carId: c.id,
          message: `${c.brand} ${c.model}: ریسک نقدشوندگی — زمان فروش تخمینی بالا یا امتیاز نقدشوندگی ضعیف.`,
          severity: liq != null && liq >= 70 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          metadata: { avgDaysToSell: liq, liquidityScore: liqScore },
        });
      }

      const inv = c.scores?.investmentScore;
      const pred = toNumber(c.pricePrediction?.predictedChange30d);
      if (
        inv != null &&
        pred != null &&
        inv >= 72 &&
        pred > 0.012 &&
        (vol == null || vol >= 38)
      ) {
        push(MarketAlertType.BEST_INVESTMENT_SIGNAL, {
          carId: c.id,
          message: `${c.brand} ${c.model}: سیگنال ترکیبی سرمایه‌گذاری مثبت (بر اساس امتیاز و پیش‌بینی).`,
          severity: AlertSeverity.LOW,
          metadata: { investmentScore: inv, predictedChange30d: pred },
        });
      }
    }

    const today = startOfUtcDay(new Date());
    const cycles = await this.prisma.marketCycle.findMany({
      where: { snapshotDate: today },
    });
    for (const cy of cycles) {
      if (cy.cycleType === MarketCycleType.BEAR) {
        push(MarketAlertType.MARKET_ENTERING_BEAR, {
          segment: cy.segment,
          message: `سگمنت «${cy.segment}» در فاز خرسی طبق مدل چرخهٔ بازار.`,
          severity: AlertSeverity.HIGH,
          metadata: { cycleType: cy.cycleType, confidence: cy.confidenceScore },
        });
      }
      if (cy.cycleType === MarketCycleType.BULL) {
        push(MarketAlertType.MARKET_ENTERING_BULL, {
          segment: cy.segment,
          message: `سگمنت «${cy.segment}» در فاز گاوی طبق مدل چرخهٔ بازار.`,
          severity: AlertSeverity.LOW,
          metadata: { cycleType: cy.cycleType },
        });
      }
    }

    const prev = new Date(today);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const idxToday = await this.prisma.segmentMarketIndex.findMany({
      where: { snapshotDate: today },
    });
    const idxPrev = await this.prisma.segmentMarketIndex.findMany({
      where: { snapshotDate: prev },
    });
    const prevMap = new Map(idxPrev.map((r) => [r.segment, r]));
    for (const r of idxToday) {
      const b = prevMap.get(r.segment);
      if (!b) continue;
      const delta = r.indexValue - b.indexValue;
      if (delta >= 4 && (r.avgPredictedChange30d ?? 0) >= 0.02) {
        push(MarketAlertType.SEGMENT_OVERHEATING, {
          segment: r.segment,
          message: `سگمنت «${r.segment}» شاخص ترکیبی را به‌سرعت بالا برده؛ ریسک اشتباه‌خرید کوتاه‌مدت.`,
          severity: delta >= 8 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          metadata: { indexDelta: delta, indexValue: r.indexValue },
        });
      }
      if (delta <= -4 && (r.avgPredictedChange30d ?? 0) <= -0.015) {
        push(MarketAlertType.SEGMENT_CRASH_RISK, {
          segment: r.segment,
          message: `سگمنت «${r.segment}» افت تند در شاخص و پیش‌بینی منفی — احتیاط.`,
          severity: delta <= -8 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          metadata: { indexDelta: delta, indexValue: r.indexValue },
        });
      }
    }

    if (alerts.length) {
      await this.prisma.marketAlert.createMany({ data: alerts });
    }

    this.logger.log(`Market alerts refreshed → ${alerts.length} active rows`);
    return { created: alerts.length };
  }

  private async loadLatestLiquidityByCar(): Promise<
    Map<string, { avgDaysToSell: number | null }>
  > {
    const raw = await this.prisma.$queryRaw<
      Array<{ carId: string; avgDaysToSell: number | null }>
    >`
      SELECT DISTINCT ON ("carId") "carId", "avgDaysToSell"
      FROM "CarLiquidityStats"
      WHERE "avgDaysToSell" IS NOT NULL
      ORDER BY "carId", "snapshotDate" DESC
    `;
    return new Map(raw.map((r) => [r.carId, { avgDaysToSell: r.avgDaysToSell }]));
  }
}
