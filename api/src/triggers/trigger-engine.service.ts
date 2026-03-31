import { Injectable, Logger } from '@nestjs/common';
import {
  AlertSeverity,
  InsightType,
  Prisma,
  TriggerEngineType,
  UserNotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserNotificationService } from '../delivery/user-notification.service';
import { toNumber } from '../common/decimal.util';
import {
  AdaptiveWeightService,
  SCOPE_TRIGGER_THRESHOLDS,
} from '../learning/adaptive-weight.service';

const OPPORTUNITY_TYPES: InsightType[] = [
  InsightType.BEST_INVESTMENT_OPPORTUNITY,
  InsightType.UNDERVALUED,
  InsightType.ENTERING_BULL_TREND,
  InsightType.HIGH_DEMAND_LOW_SUPPLY,
];

function subHours(d: Date, h: number): Date {
  return new Date(d.getTime() - h * 3_600_000);
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class TriggerEngineService {
  private readonly logger = new Logger(TriggerEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userNotifications: UserNotificationService,
    private readonly adaptive: AdaptiveWeightService,
  ) {}

  async recentEvents(limit = 40) {
    const take = Math.min(Math.max(limit, 1), 120);
    return this.prisma.triggerEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        car: { select: { id: true, brand: true, model: true, year: true } },
      },
    });
  }

  async marketEvents(limit = 50) {
    return this.prisma.triggerEvent.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 150),
      include: {
        car: { select: { id: true, brand: true, model: true, year: true } },
      },
    });
  }

  async userEvents(userId: string, limit = 40) {
    return this.prisma.triggerEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  /** هشدارها و تریگرهای اخیر مربوط به کاربر (Advisor / Today Action). */
  async getUserAlerts(userId: string, limit = 40) {
    return this.userEvents(userId, limit);
  }

  async portfolioContext(userId: string) {
    const [recs, driftEvents] = await Promise.all([
      this.prisma.userPortfolioRecommendation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.triggerEvent.findMany({
        where: { userId, type: TriggerEngineType.PORTFOLIO_DRIFT },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);
    return {
      recentRecommendations: recs,
      portfolioDriftTriggers: driftEvents,
    };
  }

  async ensureDefaultRules() {
    const defs: Array<{
      name: string;
      type: TriggerEngineType;
      threshold?: number;
    }> = [
      { name: 'def_price_drop', type: TriggerEngineType.PRICE_DROP_THRESHOLD, threshold: 0.07 },
      { name: 'def_price_spike', type: TriggerEngineType.PRICE_SPIKE, threshold: 0.08 },
      { name: 'def_vol_spike', type: TriggerEngineType.VOLATILITY_SPIKE, threshold: 78 },
      { name: 'def_liq_low', type: TriggerEngineType.LIQUIDITY_DROP, threshold: 38 },
      { name: 'def_demand_spike', type: TriggerEngineType.DEMAND_SPIKE, threshold: 72 },
      { name: 'def_risk_high', type: TriggerEngineType.RISK_INCREASE, threshold: 68 },
      { name: 'def_portfolio_drift', type: TriggerEngineType.PORTFOLIO_DRIFT, threshold: 0.14 },
      { name: 'def_segment_move', type: TriggerEngineType.SEGMENT_ROTATION, threshold: 0.045 },
    ];
    for (const d of defs) {
      await this.prisma.triggerRule.upsert({
        where: { name: d.name },
        create: {
          name: d.name,
          type: d.type,
          threshold: d.threshold,
          condition: {},
          isActive: true,
        },
        update: { threshold: d.threshold, isActive: true },
      });
    }
  }

  async evaluateAndPersist(options?: {
    routeNotifications?: boolean;
    carSample?: number;
  }) {
    await this.ensureDefaultRules();
    const rules = await this.prisma.triggerRule.findMany({
      where: { isActive: true },
    });
    const trigAd = await this.adaptive.getWeights(SCOPE_TRIGGER_THRESHOLDS);
    const th = (t: TriggerEngineType, fallback: number) => {
      const fromRule = rules.find((r) => r.type === t)?.threshold;
      const base = fromRule != null ? Number(fromRule) : fallback;
      return this.adaptive.thresholdForTriggerType(trigAd, t, base);
    };

    const takeCars = Math.min(Math.max(options?.carSample ?? 90, 20), 200);
    const cars = await this.prisma.car.findMany({
      where: {
        marketData: { isNot: null },
        scores: { investmentScore: { not: null } },
      },
      include: { marketData: true, scores: true, pricePrediction: true },
      orderBy: { scores: { investmentScore: 'desc' } },
      take: takeCars,
    });

    const toCreate: Prisma.TriggerEventCreateManyInput[] = [];
    const now = new Date();
    const runStart = new Date();

    const pushEv = async (
      row: Omit<Prisma.TriggerEventCreateManyInput, 'id' | 'createdAt'>,
      dedupeHours = 10,
    ) => {
      const dup = await this.recentDuplicate(
        row.type as TriggerEngineType,
        row.carId as string | undefined,
        row.userId as string | undefined,
        row.segment as string | undefined,
        dedupeHours,
      );
      if (dup) return;
      toCreate.push(row);
    };

    const td = th(TriggerEngineType.PRICE_DROP_THRESHOLD, 0.07);
    const ts = th(TriggerEngineType.PRICE_SPIKE, 0.08);
    const tv = th(TriggerEngineType.VOLATILITY_SPIKE, 78);
    const tl = th(TriggerEngineType.LIQUIDITY_DROP, 38);
    const tdm = th(TriggerEngineType.DEMAND_SPIKE, 72);
    const tr = th(TriggerEngineType.RISK_INCREASE, 68);

    for (const car of cars) {
      const md = car.marketData;
      const sc = car.scores;
      if (!md) continue;
      const label = `${car.brand} ${car.model} ${car.year}`;
      const ch30 = md.priceChange30d != null ? toNumber(md.priceChange30d) : null;
      const ch7 = md.priceChange7d != null ? toNumber(md.priceChange7d) : null;
      const vs = md.volatilityScore ?? null;
      const liq = md.liquidityScore ?? null;
      const dscore = md.demandScore ?? null;
      const risk = sc?.riskScore ?? null;
      const sig = md.marketSignal?.toUpperCase() ?? null;
      const pred =
        car.pricePrediction?.predictedChange90d != null
          ? Number(car.pricePrediction.predictedChange90d)
          : null;

      if (ch30 != null && ch30 <= -td) {
        const conf = Math.min(95, 55 + Math.round(Math.abs(ch30) * 400));
        await pushEv({
          type: TriggerEngineType.PRICE_DROP_THRESHOLD,
          severity: ch30 <= -0.12 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: افت قیمت حدود ${(ch30 * 100).toFixed(1)}٪ در ۳۰ روز اخیر.`,
          action: 'اگر در واچ‌لیست است، بررسی هدف خرید و ریسک سگمنت را انجام دهید.',
          confidence: conf,
          metadata: { ch30, ch7, carId: car.id } as Prisma.InputJsonValue,
        });
      }

      if (ch30 != null && ch30 >= ts) {
        await pushEv({
          type: TriggerEngineType.PRICE_SPIKE,
          severity: AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: جهش قیمت حدود ${(ch30 * 100).toFixed(1)}٪ در ۳۰ روز.`,
          action: 'احتمال حباب کوتاه‌مدت؛ خرید عجولانه بدون حد ضرر توصیه نمی‌شود.',
          confidence: 62,
          metadata: { ch30 } as Prisma.InputJsonValue,
        });
      }

      if (vs != null && vs >= tv) {
        await pushEv({
          type: TriggerEngineType.VOLATILITY_SPIKE,
          severity: vs >= 85 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: نوسان قیمت در مدل بالاست (امتیاز ${vs.toFixed(0)}).`,
          action: 'کاهش سهم در سبد یا منتظر تثبیت باشید.',
          confidence: 70,
          metadata: { volatilityScore: vs } as Prisma.InputJsonValue,
        });
      }

      if (liq != null && liq <= tl) {
        await pushEv({
          type: TriggerEngineType.LIQUIDITY_DROP,
          severity: AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: نقدشوندگی پایین‌تر از آستانه (حدود ${liq.toFixed(0)}).`,
          action: 'برای خروج سریع برنامه‌ریزی کنید یا قیمت را واقع‌بینانه‌تر کنید.',
          confidence: 65,
          metadata: { liquidityScore: liq } as Prisma.InputJsonValue,
        });
      }

      if (dscore != null && dscore >= tdm) {
        await pushEv({
          type: TriggerEngineType.DEMAND_SPIKE,
          severity: AlertSeverity.LOW,
          carId: car.id,
          message: `${label}: سیگنال تقاضای قوی در مدل بازار.`,
          action: 'اگر کفایت نقدشوندگی OK است، فرصت کوتاه‌مدت قابل بررسی است.',
          confidence: 58,
          metadata: { demandScore: dscore, adsCount: md.adsCount } as Prisma.InputJsonValue,
        });
      }

      if (risk != null && risk >= tr) {
        await pushEv({
          type: TriggerEngineType.RISK_INCREASE,
          severity: risk >= 75 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: امتیاز ریسک بالا (${risk.toFixed(0)}).`,
          action: 'سهم این خودرو در سبد را محدود یا با دارایی کم‌همبستر جبران کنید.',
          confidence: 72,
          metadata: { riskScore: risk } as Prisma.InputJsonValue,
        });
      }

      if (sig && ch30 != null) {
        const diverge =
          (sig === 'BUY' && ch30 < -0.035) || (sig === 'SELL' && ch30 > 0.035);
        if (diverge) {
          await pushEv({
            type: TriggerEngineType.SIGNAL_CHANGE,
            severity: AlertSeverity.MEDIUM,
            carId: car.id,
            message: `${label}: ناهم‌جهتی سیگنال (${sig}) با مومنتوم قیمت ۳۰روزه.`,
            action: 'صبر برای تایید روند یا ورود تدریجی با حجم کم.',
            confidence: 55,
            metadata: { signal: sig, ch30 } as Prisma.InputJsonValue,
          });
        }
      }

      const underval =
        pred != null &&
        ch30 != null &&
        pred > 0.04 &&
        ch30 < -0.02;
      if (underval) {
        await pushEv({
          type: TriggerEngineType.OPPORTUNITY_DETECTED,
          severity: AlertSeverity.MEDIUM,
          carId: car.id,
          message: `${label}: افت قیمت همراه با پیش‌بینی مثبت نسبی — زمینهٔ ارزش‌گذاری.`,
          action: 'بررسی فنی/قیمت واقعی بازار قبل از ورود.',
          confidence: 60,
          metadata: { pred90: pred, ch30 } as Prisma.InputJsonValue,
        });
      }
    }

    const insightRows = await this.prisma.marketInsight.findMany({
      where: {
        insightType: { in: OPPORTUNITY_TYPES },
        snapshotDate: { gte: subHours(now, 36) },
        carId: { not: null },
      },
      orderBy: { score: 'desc' },
      take: 25,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true },
        },
      },
    });
    for (const ins of insightRows) {
      if (!ins.carId || !ins.car) continue;
      await pushEv(
        {
          type: TriggerEngineType.OPPORTUNITY_DETECTED,
          severity:
            ins.score >= 78 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          carId: ins.carId,
          message: `${ins.car.brand} ${ins.car.model}: ${ins.title}`,
          action: 'مقایسه با جایگزین‌های هم‌سگمنت و بررسی سناریو.',
          confidence: Math.min(92, 50 + ins.score * 0.45),
          metadata: {
            insightId: ins.id,
            insightType: ins.insightType,
          } as Prisma.InputJsonValue,
        },
        18,
      );
    }

    await this.detectSegmentRotation(toCreate, th);
    await this.detectMarketCycleChange(toCreate);
    await this.detectStrategyChange(toCreate);
    await this.detectPortfolioDrift(toCreate, th);

    const watchHits = await this.prisma.userWatchlist.findMany({
      include: {
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            marketData: true,
          },
        },
      },
      take: 400,
    });
    for (const w of watchHits) {
      const md = w.car.marketData;
      const avg = md?.avgPrice != null ? toNumber(md.avgPrice) : null;
      const tb = toNumber(w.targetBuyPrice);
      const tsell = toNumber(w.targetSellPrice);
      if (w.alertOnPriceDrop && tb != null && avg != null && avg <= tb) {
        await pushEv(
          {
            type: TriggerEngineType.WATCHLIST_HIT,
            severity: AlertSeverity.HIGH,
            carId: w.carId,
            userId: w.userId,
            message: `هدف خرید برای ${w.car.brand} ${w.car.model} محقق شد (تقریبی).`,
            action: 'در صورت تمایل، مذاکره یا بازرسی را زمان‌بندی کنید.',
            confidence: 80,
            metadata: { targetBuy: tb, avgPrice: avg } as Prisma.InputJsonValue,
          },
          20,
        );
      }
      if (w.alertOnPriceRise && tsell != null && avg != null && avg >= tsell) {
        await pushEv(
          {
            type: TriggerEngineType.WATCHLIST_HIT,
            severity: AlertSeverity.MEDIUM,
            carId: w.carId,
            userId: w.userId,
            message: `قیمت به هدف فروش نزدیک/بالاتر از ${w.car.brand} ${w.car.model}.`,
            action: 'تصمیم گرفتن برای نگه‌داری یا فروش.',
            confidence: 72,
            metadata: { targetSell: tsell, avgPrice: avg } as Prisma.InputJsonValue,
          },
          20,
        );
      }
    }

    if (toCreate.length) {
      await this.prisma.triggerEvent.createMany({ data: toCreate });
    }

    let routed = 0;
    if (options?.routeNotifications !== false && toCreate.length) {
      const fresh = await this.prisma.triggerEvent.findMany({
        where: { createdAt: { gte: runStart } },
        orderBy: { createdAt: 'desc' },
      });
      for (const ev of fresh) {
        routed += await this.routeEventToUsers(ev);
      }
    }

    this.logger.log(
      `Trigger engine: persisted ${toCreate.length}, notifications routed ${routed}`,
    );
    return { created: toCreate.length, routed };
  }

  private async routeEventToUsers(ev: {
    id: string;
    type: TriggerEngineType;
    severity: AlertSeverity;
    carId: string | null;
    segment: string | null;
    userId: string | null;
    message: string;
    action: string;
    confidence?: number | null;
  }): Promise<number> {
    let n = 0;
    const day = fmtDay(startOfUtcDay(new Date()));
    const meta = {
      triggerEventId: ev.id,
      triggerType: ev.type,
      confidence: ev.confidence ?? undefined,
    } as Prisma.InputJsonValue;

    const titleFa = `هوشمند: ${this.typeLabel(ev.type)}`;

    if (ev.userId) {
      const r = await this.userNotifications.createWithCooldown({
        userId: ev.userId,
        type: UserNotificationType.TRIGGER_ENGINE,
        title: titleFa,
        message: `${ev.message} — ${ev.action}`,
        carId: ev.carId ?? undefined,
        segment: ev.segment ?? undefined,
        severity: ev.severity,
        dedupeKey: `trg:${ev.type}:${ev.carId ?? 'na'}:${ev.userId}:${day}`,
        metadata: meta,
        cooldownHours: 18,
      });
      return r.created ? 1 : 0;
    }

    if (!ev.carId) return 0;

    const watchers = await this.prisma.userWatchlist.findMany({
      where: { carId: ev.carId },
      select: { userId: true },
    });
    for (const { userId } of watchers) {
      const r = await this.userNotifications.createWithCooldown({
        userId,
        type: UserNotificationType.TRIGGER_ENGINE,
        title: titleFa,
        message: `${ev.message} — ${ev.action}`,
        carId: ev.carId,
        segment: ev.segment ?? undefined,
        severity: ev.severity,
        dedupeKey: `trg:${ev.type}:${ev.carId}:${userId}:${day}`,
        metadata: meta,
        cooldownHours: 20,
      });
      if (r.created) n += 1;
    }
    return n;
  }

  private typeLabel(t: TriggerEngineType): string {
    switch (t) {
      case TriggerEngineType.PRICE_DROP_THRESHOLD:
        return 'افت قیمت';
      case TriggerEngineType.PRICE_SPIKE:
        return 'جهش قیمت';
      case TriggerEngineType.VOLATILITY_SPIKE:
        return 'نوسان';
      case TriggerEngineType.OPPORTUNITY_DETECTED:
        return 'فرصت';
      case TriggerEngineType.WATCHLIST_HIT:
        return 'واچ‌لیست';
      default:
        return t;
    }
  }

  private async recentDuplicate(
    type: TriggerEngineType,
    carId?: string | null,
    userId?: string | null,
    segment?: string | null,
    hours = 10,
  ) {
    const since = subHours(new Date(), hours);
    const where: Prisma.TriggerEventWhereInput = {
      type,
      createdAt: { gte: since },
    };
    if (carId) where.carId = carId;
    else where.carId = null;
    if (userId) where.userId = userId;
    else where.userId = null;
    if (segment) where.segment = segment;
    return this.prisma.triggerEvent.findFirst({ where });
  }

  private async detectSegmentRotation(
    batch: Prisma.TriggerEventCreateManyInput[],
    th: (t: TriggerEngineType, fb: number) => number,
  ) {
    const moveThr = th(TriggerEngineType.SEGMENT_ROTATION, 0.045);
    const dates = await this.prisma.segmentMarketIndex.findMany({
      distinct: ['snapshotDate'],
      orderBy: { snapshotDate: 'desc' },
      take: 2,
      select: { snapshotDate: true },
    });
    if (dates.length < 2) return;
    const d0 = dates[0]!.snapshotDate;
    const d1 = dates[1]!.snapshotDate;
    const [rows0, rows1] = await Promise.all([
      this.prisma.segmentMarketIndex.findMany({ where: { snapshotDate: d0 } }),
      this.prisma.segmentMarketIndex.findMany({ where: { snapshotDate: d1 } }),
    ]);
    const prev = new Map(rows1.map((r) => [r.segment, r.indexValue]));
    for (const r of rows0) {
      const p = prev.get(r.segment);
      if (p == null || Math.abs(p) < 1e-6) continue;
      const ch = (r.indexValue - p) / Math.abs(p);
      if (Math.abs(ch) < moveThr) continue;
      const dup = await this.recentDuplicate(
        TriggerEngineType.SEGMENT_ROTATION,
        undefined,
        undefined,
        r.segment,
        16,
      );
      if (dup) continue;
      batch.push({
        type: TriggerEngineType.SEGMENT_ROTATION,
        severity:
          Math.abs(ch) >= moveThr * 2 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        segment: r.segment,
        message: `شاخص سگمنت «${r.segment}» نسبت به روز قبل حدود ${(ch * 100).toFixed(1)}٪ حرکت کرده است.`,
        action: 'چرخش سگمنت را در استراتژی و سبد در نظر بگیرید.',
        confidence: 68,
        metadata: { change: ch, snapshotDate: d0.toISOString() } as Prisma.InputJsonValue,
      });
    }
  }

  private async detectMarketCycleChange(
    batch: Prisma.TriggerEventCreateManyInput[],
  ) {
    const recent = await this.prisma.marketCycle.findMany({
      orderBy: { snapshotDate: 'desc' },
      take: 400,
    });
    const bySeg = new Map<string, typeof recent>();
    for (const c of recent) {
      const arr = bySeg.get(c.segment) ?? [];
      arr.push(c);
      bySeg.set(c.segment, arr);
    }
    for (const [seg, arr] of bySeg) {
      if (arr.length < 2) continue;
      arr.sort(
        (a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime(),
      );
      const latest = arr[0]!;
      const prevRow = arr[1]!;
      if (latest.cycleType === prevRow.cycleType) continue;
      const dup = await this.recentDuplicate(
        TriggerEngineType.MARKET_CYCLE_CHANGE,
        undefined,
        undefined,
        seg,
        30,
      );
      if (dup) continue;
      batch.push({
        type: TriggerEngineType.MARKET_CYCLE_CHANGE,
        severity: AlertSeverity.MEDIUM,
        segment: seg,
        message: `چرخهٔ بازار سگمنت «${seg}» از «${prevRow.cycleType}» به «${latest.cycleType}» تغییر کرده است.`,
        action: 'بازبینی وزن سگمنت در سبد و استراتژی مومنتومی/دفاعی.',
        confidence: 75,
        metadata: {
          from: prevRow.cycleType,
          to: latest.cycleType,
          snapshotDate: latest.snapshotDate.toISOString(),
        } as Prisma.InputJsonValue,
      });
    }
  }

  private async detectStrategyChange(
    batch: Prisma.TriggerEventCreateManyInput[],
  ) {
    const snaps = await this.prisma.decisionSnapshot.findMany({
      where: { userId: null },
      orderBy: { snapshotDate: 'desc' },
      take: 2,
    });
    if (snaps.length < 2) return;
    const [a, b] = snaps;
    if (a!.strategyDecision === b!.strategyDecision) return;
    const dup = await this.recentDuplicate(
      TriggerEngineType.STRATEGY_CHANGE,
      undefined,
      undefined,
      undefined,
      36,
    );
    if (dup) return;
    batch.push({
      type: TriggerEngineType.STRATEGY_CHANGE,
      severity: AlertSeverity.MEDIUM,
      message: `استراتژی پیشنهادی سطح بازار از «${b!.strategyDecision}» به «${a!.strategyDecision}» تغییر کرده است.`,
      action: 'تراز سبد و ریسک شخصی را با استراتژی جدید هم‌راستا کنید.',
      confidence: 70,
        metadata: {
          from: b!.strategyDecision,
          to: a!.strategyDecision,
        } as Prisma.InputJsonValue,
      });
  }

  private async detectPortfolioDrift(
    batch: Prisma.TriggerEventCreateManyInput[],
    th: (t: TriggerEngineType, fb: number) => number,
  ) {
    const driftThr = th(TriggerEngineType.PORTFOLIO_DRIFT, 0.14);
    const grouped = await this.prisma.userPortfolioRecommendation.groupBy({
      by: ['userId'],
      _count: { id: true },
    });
    const users = grouped.filter((g) => g._count.id >= 2);
    for (const { userId } of users) {
      const recs = await this.prisma.userPortfolioRecommendation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      if (recs.length < 2) continue;
      const w0 = this.weightsFromResult(recs[0]!.result);
      const w1 = this.weightsFromResult(recs[1]!.result);
      if (!w0.size || !w1.size) continue;
      let l1 = 0;
      const keys = new Set([...w0.keys(), ...w1.keys()]);
      for (const k of keys) {
        l1 += Math.abs((w0.get(k) ?? 0) - (w1.get(k) ?? 0));
      }
      if (l1 < driftThr) continue;
      const dup = await this.recentDuplicate(
        TriggerEngineType.PORTFOLIO_DRIFT,
        undefined,
        userId,
        undefined,
        48,
      );
      if (dup) continue;
      batch.push({
        type: TriggerEngineType.PORTFOLIO_DRIFT,
        severity: l1 >= driftThr * 1.6 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        userId,
        message: `سبد پیشنهادی شما نسبت به آخرین توصیه منحرف شده است (انحراف L1 ≈ ${(l1 * 100).toFixed(0)}٪ وزن).`,
        action: 'اجرای دوبارهٔ توصیه یا بازمتعادلسازی با موتور بهینه‌ساز.',
        confidence: 66,
        metadata: { l1Drift: l1 } as Prisma.InputJsonValue,
      });
    }
  }

  private weightsFromResult(
    result: unknown,
  ): Map<string, number> {
    const m = new Map<string, number>();
    if (!result || typeof result !== 'object') return m;
    const cars = (result as { cars?: Array<{ carId?: string; weight?: number }> }).cars;
    if (!cars?.length) return m;
    for (const c of cars) {
      if (c.carId != null && c.weight != null) m.set(c.carId, Number(c.weight));
    }
    return m;
  }
}
