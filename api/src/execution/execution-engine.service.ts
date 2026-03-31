import { Injectable } from '@nestjs/common';
import {
  AlertSeverity,
  DecisionMarketOutlook,
  DecisionPortfolioAction,
  DecisionStrategyAction,
  Prisma,
  TriggerEngineType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceOverviewService } from '../intelligence/intelligence-overview.service';
import { AdaptiveRuntimeConfigService } from '../adaptive/adaptive-runtime-config.service';
import { PortfolioAutoRebalanceService } from './portfolio-auto-rebalance.service';
import type { DecisionSummaryPayload } from '../decision/decision.types';
import type {
  ExecutionAction,
  ExecutionActionType,
  ExecutionPlanResult,
  ExecutionSimulationSummary,
  PortfolioRebalanceResult,
} from './execution.types';
import {
  totalVariationDistance,
  weightMapFromCars,
} from './execution-portfolio.util';

function utcToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type LiveBattery = {
  results?: Array<{
    scenarioId: string;
    run: { maxDrawdown: { mean: number }; lossProbability?: number };
  }>;
};

function worstStressFromBattery(
  battery: LiveBattery | null | undefined,
): { maxDrawdown: number; scenarioId?: string } | null {
  if (!battery?.results?.length) return null;
  let worst = -1;
  let scenarioId: string | undefined;
  for (const r of battery.results) {
    const m = r.run?.maxDrawdown?.mean;
    if (typeof m === 'number' && Number.isFinite(m) && m > worst) {
      worst = m;
      scenarioId = r.scenarioId;
    }
  }
  return worst >= 0 ? { maxDrawdown: worst, scenarioId } : null;
}

type ExecCtx = {
  unified: Awaited<
    ReturnType<IntelligenceOverviewService['getUnifiedOverview']>
  >;
  decision: DecisionSummaryPayload;
  strategyAdvice: Awaited<
    ReturnType<IntelligenceOverviewService['getUnifiedOverview']>
  >['strategy'];
  recentTriggers: Awaited<
    ReturnType<PrismaService['triggerEvent']['findMany']>
  >;
  lastOpt: Awaited<
    ReturnType<PrismaService['portfolioOptimizationResult']['findFirst']>
  >;
  stressHint: { maxDrawdown: number; scenarioId?: string } | null;
  adaptiveModels: Record<string, unknown>;
  adaptive: {
    scoring: Record<string, number>;
    decisionConf: Record<string, number>;
    triggerThresholds: Record<string, number>;
  };
  rebalance: PortfolioRebalanceResult | null;
  watchlistIds: Set<string>;
};

@Injectable()
export class ExecutionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceOverviewService,
    private readonly runtime: AdaptiveRuntimeConfigService,
    private readonly autoRebalance: PortfolioAutoRebalanceService,
  ) {}

  actionCatalog(): Array<{
    actionType: ExecutionActionType;
    label: string;
    description: string;
  }> {
    return [
      {
        actionType: 'REBALANCE_PORTFOLIO',
        label: 'تناسب مجدد سبد',
        description: 'هم‌راستا کردن وزن‌ها با الگوی بهینه و تحمل ریسک',
      },
      {
        actionType: 'BUY_CAR',
        label: 'خرید / افزودن به سبد',
        description: 'تخصیص سرمایه به خودروهای انتخاب‌شده توسط موتور',
      },
      {
        actionType: 'SELL_CAR',
        label: 'فروش / کاهش سهم',
        description: 'کاهش موقعیت یا خروج از خودروهای پرریسک',
      },
      {
        actionType: 'REDUCE_RISK',
        label: 'کاهش ریسک',
        description: 'کاهش نوسان یا غلظت سگمنت پرریسک',
      },
      {
        actionType: 'INCREASE_RISK',
        label: 'افزایش ریسک هدفمند',
        description: 'در صورت فاز باز منطقی و تحمل کاربر',
      },
      {
        actionType: 'MOVE_TO_CASH',
        label: 'انتقال به نقد',
        description: 'کاهش قرارگیری در دارایی‌های پرنوسان',
      },
      {
        actionType: 'SWITCH_STRATEGY',
        label: 'تغییر استراتژی بک‌تست',
        description: 'هم‌راستا با Strategy Advisor',
      },
      {
        actionType: 'ROTATE_SEGMENT',
        label: 'چرخش سگمنتی',
        description: 'جابه‌جایی تمرکز بین سگمنت‌ها',
      },
      {
        actionType: 'HOLD_POSITION',
        label: 'نگهداری',
        description: 'بدون اقدام فوری قابل‌دفاع',
      },
      {
        actionType: 'WATCHLIST_ADD',
        label: 'افزودن به واچ‌لیست',
        description: 'ردیابی فرصت بدون خرید فوری',
      },
      {
        actionType: 'WATCHLIST_REMOVE',
        label: 'حذف از واچ‌لیست',
        description: 'پاک‌سازی پس از فروش یا عدم‌تطابق',
      },
    ];
  }

  private async loadContext(userId?: string): Promise<ExecCtx> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const uid = userId?.trim();

    const [unified, recentTriggers, lastOpt, adaptiveModels, scoring, decConf, trigTh] =
      await Promise.all([
        this.intelligence.getUnifiedOverview(uid, { persist: false }),
        this.prisma.triggerEvent.findMany({
          where: {
            createdAt: { gte: since },
            ...(uid ? { OR: [{ userId: uid }, { userId: null }] } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: uid ? 40 : 60,
        }),
        this.prisma.portfolioOptimizationResult.findFirst({
          orderBy: { createdAt: 'desc' },
        }),
        this.runtime.getSelectedModels(),
        this.runtime.getScoringWeights(),
        this.runtime.getDecisionConfidenceWeights(),
        this.runtime.getTriggerThresholds(),
      ]);

    let rebalance: PortfolioRebalanceResult | null = null;
    if (uid) {
      try {
        rebalance = await this.autoRebalance.analyze(uid);
      } catch {
        rebalance = null;
      }
    }

    let watchlistIds = new Set<string>();
    if (uid) {
      const wl = await this.prisma.userWatchlist.findMany({
        where: { userId: uid },
        select: { carId: true },
      });
      watchlistIds = new Set(wl.map((w) => w.carId));
    }

    const liveBattery = unified.risk?.liveBattery as LiveBattery | undefined;
    const fromLive = worstStressFromBattery(liveBattery);
    const stressHint =
      fromLive ??
      (await this.prisma.portfolioStressTest.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { maxDrawdown: true, scenarioId: true },
      }));

    return {
      unified,
      decision: unified.decision,
      strategyAdvice: unified.strategy,
      recentTriggers,
      lastOpt,
      stressHint:
        stressHint && typeof stressHint.maxDrawdown === 'number'
          ? {
              maxDrawdown: stressHint.maxDrawdown,
              scenarioId:
                'scenarioId' in stressHint
                  ? (stressHint as { scenarioId?: string }).scenarioId
                  : undefined,
            }
          : null,
      adaptiveModels,
      adaptive: {
        scoring,
        decisionConf: decConf,
        triggerThresholds: trigTh,
      },
      rebalance,
      watchlistIds,
    };
  }

  private simulationFrom(
    rebalance: PortfolioRebalanceResult | null,
    stressHint: { maxDrawdown: number } | null,
    bestPortfolio: {
      expectedReturn?: number;
      expectedVolatility?: number;
      sharpeRatio?: number | null;
    } | null,
    portfolioProxy: {
      expectedReturn?: number;
      expectedVolatility?: number;
      expectedDrawdown?: number;
    } | null,
  ): ExecutionSimulationSummary {
    const sim: ExecutionSimulationSummary = {};
    if (rebalance?.ok && rebalance.currentSnapshot && rebalance.optimalSnapshot) {
      const cr = rebalance.currentSnapshot.expectedReturn ?? 0;
      const or = rebalance.optimalSnapshot.expectedReturn ?? 0;
      if (Number.isFinite(or - cr)) sim.expectedReturnDelta = or - cr;
      const cv = rebalance.currentSnapshot.expectedVolatility ?? 0;
      const ov = rebalance.optimalSnapshot.expectedVolatility ?? 0;
      if (Number.isFinite(cv - ov)) sim.riskReduction = cv - ov;
      const cd = rebalance.currentSnapshot.expectedDrawdown ?? null;
      const od = rebalance.optimalSnapshot.expectedDrawdown ?? null;
      if (
        cd != null &&
        od != null &&
        Number.isFinite(cd) &&
        Number.isFinite(od)
      ) {
        sim.drawdownReduction = cd - od;
      }
      if (cv > 1e-6 && ov > 1e-6) {
        sim.sharpeImprovement = or / ov - cr / cv;
      }
    } else if (bestPortfolio && portfolioProxy) {
      const cr = portfolioProxy.expectedReturn ?? 0;
      const or = bestPortfolio.expectedReturn ?? 0;
      if (Number.isFinite(or - cr)) sim.expectedReturnDelta = or - cr;
      const cv = portfolioProxy.expectedVolatility ?? 0;
      const ov = bestPortfolio.expectedVolatility ?? 0;
      if (Number.isFinite(cv - ov)) sim.riskReduction = cv - ov;
      const cd = portfolioProxy.expectedDrawdown ?? null;
      if (cd != null && ov > 1e-6 && or > -1) {
        sim.sharpeImprovement = or / ov - (cr > 0 && cv > 1e-6 ? cr / cv : 0);
      }
    }
    if (
      stressHint &&
      sim.riskReduction != null &&
      (sim.drawdownReduction == null || sim.drawdownReduction === 0)
    ) {
      sim.drawdownReduction = Math.min(
        0.12,
        Math.max(0, sim.riskReduction * 0.05) * stressHint.maxDrawdown,
      );
    }
    return sim;
  }

  private applyAdaptiveTuning(
    actions: ExecutionAction[],
    adaptive: ExecCtx['adaptive'],
  ): ExecutionAction[] {
    const riskW = adaptive.scoring.risk ?? 1;
    const invW =
      adaptive.scoring.investment ??
      ((adaptive.scoring.investment_dep ?? 1) +
        (adaptive.scoring.investment_liq ?? 1)) /
        2;
    const scale = adaptive.decisionConf.scale ?? 1;
    const volTh = adaptive.triggerThresholds.volatility_spike ?? 78;
    const volSens = Math.max(0, Math.min(2.5, (82 - volTh) / 10));

    return actions.map((a) => {
      let boost = 0;
      if (
        a.actionType === 'REDUCE_RISK' ||
        a.actionType === 'MOVE_TO_CASH' ||
        a.actionType === 'SELL_CAR'
      ) {
        if (riskW > 1.03) boost += 1;
        if (scale < 0.94) boost += 1;
        boost += volSens * 0.4;
      }
      if (a.actionType === 'REBALANCE_PORTFOLIO') {
        if (scale < 1) boost += 0.5;
        if (riskW > 1.04) boost += 0.5;
      }
      if (
        a.actionType === 'BUY_CAR' ||
        a.actionType === 'INCREASE_RISK'
      ) {
        if (invW > 1.06) boost += 0.5;
        if (scale < 0.9) boost -= 1.5;
        if (riskW > 1.08) boost -= 0.5;
      }
      if (a.actionType === 'HOLD_POSITION' && scale < 0.93) {
        boost -= 1;
      }
      const priority = Math.min(
        10,
        Math.max(1, Math.round(a.priority + boost)),
      );
      const confidence = Math.min(
        98,
        Math.max(22, Math.round(a.confidence + (scale < 0.92 ? -4 : 0))),
      );
      return { ...a, priority, confidence };
    });
  }

  private addFrontierAlignment(ctx: ExecCtx, push: (a: ExecutionAction) => void) {
    const bp = ctx.unified.bestPortfolio as {
      methodology?: string;
      weightMap?: Record<string, number>;
      expectedReturn?: number;
      sharpeRatio?: number | null;
    } | null;
    const port = ctx.unified.portfolio as {
      cars?: Array<{ carId: string; weight?: number }>;
    } | null;
    if (!bp?.weightMap || !port?.cars?.length) return;
    const n = Object.keys(bp.weightMap).length;
    if (n < 2) return;
    const wmTarget = bp.weightMap;
    const drift = totalVariationDistance(
      weightMapFromCars(port.cars),
      new Map(Object.entries(wmTarget)),
    );
    if (drift < 0.055) return;
    push({
      actionType: 'REBALANCE_PORTFOLIO',
      priority: 7,
      relatedCars: Object.keys(wmTarget).slice(0, 16),
      targetAllocation: { ...wmTarget },
      reason: `هم‌راستایی با بستهٔ کارا (متد ${bp.methodology ?? 'opt'})؛ واگرایی تخمینی ${(drift * 100).toFixed(1)}٪ نسبت به نمای سبد فعلی در Intelligence Overview.`,
      confidence: Math.min(
        88,
        ctx.decision.confidenceScore + Math.round(drift * 30),
      ),
      expectedImpact:
        bp.sharpeRatio != null
          ? `نزدیک‌شدن به جبهه با شارپ حدود ${bp.sharpeRatio.toFixed(2)}`
          : 'نزدیک‌شدن به وزن‌های بهینهٔ محاسبه‌شده',
      riskImpact: 'تغییر ترکیب — اجرای مرحله‌ای برای کنترل اسلیپیج',
    });
  }

  private composeActions(ctx: ExecCtx): ExecutionAction[] {
    const actions: ExecutionAction[] = [];
    const d = ctx.decision;
    const volRows = ctx.unified.market?.volatilityOverview as
      | Array<{ volatilityScore?: number | null }>
      | undefined;
    const avgVol =
      volRows && volRows.length > 0
        ? volRows.reduce(
            (s, r) => s + (Number(r.volatilityScore) || 0),
            0,
          ) / volRows.length
        : null;
    const highVolMarket = avgVol != null && avgVol >= 68;

    const push = (a: ExecutionAction) => actions.push(a);

    const activeAlerts = ctx.unified.market?.activeAlertsCount ?? 0;
    if (activeAlerts > 28) {
      push({
        actionType: 'REDUCE_RISK',
        priority: 6,
        reason: `حجم هشدارهای فعال در نمای هوشمندی بازار بالاست (${activeAlerts}).`,
        confidence: Math.min(78, d.confidenceScore),
        expectedImpact: 'کاهش حساسیت به نویز کوتاه‌مدت',
        riskImpact: 'کمتر کردن exposure در خودروهای پرحاشیه',
      });
    }

    if (d.portfolioDecision === DecisionPortfolioAction.REBALANCE) {
      push({
        actionType: 'REBALANCE_PORTFOLIO',
        priority: 8,
        reason:
          'موتور تصمیم: سبد نیاز به بازتنظیم وزن‌ها نسبت به شرایط فعلی دارد.',
        confidence: d.confidenceScore,
        expectedImpact: 'کاهش واگرایی هدف سبد با مدل بهینه',
        riskImpact: 'کنترل بهتر ریسک نسبت به بنچمارک فعلی',
      });
    }
    if (d.portfolioDecision === DecisionPortfolioAction.REDUCE_RISK) {
      push({
        actionType: 'REDUCE_RISK',
        priority: 9,
        reason: 'کاهش قرارگیری در موقعیت‌های پرنوسان یا پرریسک.',
        confidence: d.confidenceScore,
        expectedImpact: 'کاهش نوسان سبد',
        riskImpact: 'ریسک پایین‌تر در سناریوهای بدبینانه',
      });
    }
    if (d.portfolioDecision === DecisionPortfolioAction.INCREASE_RISK) {
      push({
        actionType: 'INCREASE_RISK',
        priority: 5,
        reason: 'فاز بازار و پروفایل کاربر امکان افزایش کنترل‌شده ریسک را می‌دهد.',
        confidence: Math.max(40, d.confidenceScore - 8),
        expectedImpact: 'بازده بالقوی بالاتر در افق میان‌مدت',
        riskImpact: 'نوسان و drawdown بالاتر',
      });
    }
    if (d.portfolioDecision === DecisionPortfolioAction.HOLD) {
      push({
        actionType: 'HOLD_POSITION',
        priority: 3,
        reason: 'سبد در محدودهٔ قابل‌قبول نسبت به هدف ریسک است.',
        confidence: d.confidenceScore,
        expectedImpact: 'کمینه‌کردن هزینه تراکنش',
        riskImpact: 'حفظ وضعیت ریسک فعلی',
      });
    }

    if (d.strategyDecision === DecisionStrategyAction.CASH) {
      push({
        actionType: 'MOVE_TO_CASH',
        priority: 9,
        reason: 'استراتژی پیشنهادی: حفظ نقد تا تثبیت سیگنال بازار.',
        confidence: d.confidenceScore,
        expectedImpact: 'کاهش exposure به دارایی‌های پرریسک',
        riskImpact: 'از دست دادن بازده صعودی احتمالی',
      });
    }
    if (d.strategyDecision === DecisionStrategyAction.SEGMENT_ROTATION) {
      const segHint = d.segmentRecommendation.slice(0, 4).join('، ');
      push({
        actionType: 'ROTATE_SEGMENT',
        priority: 7,
        reason: `چرخش سگمنتی (${segHint || 'بر اساس چرخه و momentum'}).`,
        confidence: d.confidenceScore,
        relatedCars: [],
        expectedImpact: 'بهبود تراز سگمنتی سبد',
        riskImpact: 'وابستگی موقت به سگمنت‌های جدید',
      });
    }

    const primaryKey = ctx.strategyAdvice.primary?.strategy;
    if (
      primaryKey &&
      d.strategyDecision !== DecisionStrategyAction.BALANCED &&
      d.strategyDecision !== DecisionStrategyAction.CASH
    ) {
      push({
        actionType: 'SWITCH_STRATEGY',
        priority: 6,
        reason: `هم‌راستا کردن با استراتژی برتر پیشنهادی (${ctx.strategyAdvice.primary?.title ?? primaryKey}).`,
        confidence: 62,
        expectedImpact: 'مسیر بازده شبیه‌سازی‌شده نزدیک‌تر به بک‌تست برتر',
        riskImpact: 'تغییر الگوی ریسک استراتژیک',
      });
    }

    if (d.marketOutlook === DecisionMarketOutlook.BEAR) {
      push({
        actionType: 'REDUCE_RISK',
        priority: 7,
        reason: 'چشم‌انداز بازار خرسی؛ محدود کردن exposure.',
        confidence: Math.min(d.confidenceScore, 72),
        expectedImpact: 'کاهش زیان در شوک منفی',
        riskImpact: 'محدودیت فرصت rebound',
      });
    }

    if (highVolMarket) {
      push({
        actionType: 'REDUCE_RISK',
        priority: 6,
        reason:
          'میانگین نوسان در نمای هوشمندی بازار بالاست؛ محدودیت موقعیت توصیه می‌شود.',
        confidence: Math.min(80, d.confidenceScore + 4),
        expectedImpact: 'کاهش drawdown کوتاه‌مدت',
        riskImpact: 'کم شدن بازده در روندهای تند صعودی',
      });
    }

    if (d.bestCarsToBuy.length) {
      push({
        actionType: 'BUY_CAR',
        priority: 6,
        relatedCars: d.bestCarsToBuy.slice(0, 5).map((c) => c.carId),
        reason: `خرید/تخصیص به نامزدهای برتر بر اساس امتیاز و سیگنال (${d.bestCarsToBuy.length} گزینه).`,
        confidence: d.confidenceScore,
        expectedImpact: 'بهبود کیفیت سبد هدف',
        riskImpact: 'افزایش موقعیت در خودروهای انتخابی',
      });
    }

    if (d.carsToSell.length) {
      push({
        actionType: 'SELL_CAR',
        priority: 7,
        relatedCars: d.carsToSell.map((c) => c.carId),
        reason: 'خروج یا کاهش از موقعیت‌های با سیگنال ضعیف‌تر یا ریسک بالا.',
        confidence: Math.min(88, d.confidenceScore + 5),
        expectedImpact: 'آزادسازی سرمایه و کاهش ریسک تمرکز',
        riskImpact: 'کاهش drawdown موضعی',
      });
    }

    for (const ev of ctx.recentTriggers) {
      if (ev.severity !== AlertSeverity.HIGH) continue;
      const extraVol =
        ctx.adaptive.triggerThresholds.volatility_spike < 76 ? 1 : 0;
      if (ev.type === TriggerEngineType.PORTFOLIO_DRIFT) {
        push({
          actionType: 'REBALANCE_PORTFOLIO',
          priority: 10 + extraVol * 0,
          relatedCars: ev.carId ? [ev.carId] : undefined,
          reason: `تریگر فعال با شدت بالا: ${ev.message?.slice(0, 200)}`,
          confidence: Math.min(95, (ev.confidence as number) ?? 70),
          expectedImpact: 'جبران واگرایی سبد',
          riskImpact: 'کاهش ریسک ناشی از drift',
        });
      } else if (
        ev.type === TriggerEngineType.VOLATILITY_SPIKE ||
        ev.type === TriggerEngineType.RISK_INCREASE
      ) {
        push({
          actionType: 'REDUCE_RISK',
          priority: 9 + Math.round(extraVol),
          relatedCars: ev.carId ? [ev.carId] : undefined,
          reason: `هشدار تریگر: ${ev.message?.slice(0, 180)}`,
          confidence: Math.min(90, (ev.confidence as number) ?? 68),
          expectedImpact: 'پایین آوردن نوسان سبد',
          riskImpact: 'کاهش آسیب‌پذیری به شوک',
        });
      } else if (ev.type === TriggerEngineType.LIQUIDITY_DROP) {
        push({
          actionType: 'SELL_CAR',
          priority: 6,
          relatedCars: ev.carId ? [ev.carId] : undefined,
          reason: 'نقدشوندگی پایین؛ برنامه برای خروج تدریجی.',
          confidence: 64,
          expectedImpact: 'قیمت‌گذاری واقع‌بینانه خروج',
          riskImpact: 'اسلیپیج یا زمان فروش بیشتر',
        });
      }
    }

    if (ctx.rebalance?.ok && (ctx.rebalance.drift ?? 0) >= 0.08) {
      const alloc: Record<string, number> = {};
      for (const t of ctx.rebalance.trades.slice(0, 12)) {
        alloc[t.carId] = t.deltaWeight;
      }
      push({
        actionType: 'REBALANCE_PORTFOLIO',
        priority: 8,
        relatedCars: ctx.rebalance.trades.map((t) => t.carId),
        targetAllocation: alloc,
        reason: `ری‌بالانس خودکار: واگرایی ≈ ${((ctx.rebalance.drift ?? 0) * 100).toFixed(1)}٪؛ فوریت ${ctx.rebalance.urgency}؛ زمان پیشنهادی ${ctx.rebalance.recommendedTiming}.`,
        confidence: Math.min(92, 55 + ctx.rebalance.urgency / 2),
        expectedImpact: ctx.rebalance.notes[0] ?? 'نزدیک‌شدن به سبد بهینه تازه',
        riskImpact:
          ctx.rebalance.rebalanceMode === 'FULL'
            ? 'چرخش گستردهٔ وزن‌ها — اجرای مرحله‌ای توصیه می‌شود'
            : 'تغییرات جزئی وزن',
      });
    }

    this.addFrontierAlignment(ctx, push);

    for (const c of d.bestCarsToBuy.slice(0, 3)) {
      if (ctx.watchlistIds.size && !ctx.watchlistIds.has(c.carId)) {
        push({
          actionType: 'WATCHLIST_ADD',
          priority: 4,
          relatedCars: [c.carId],
          reason: `فرصت ${c.brand} ${c.model} در واچ‌لیست نیست — رصد هدف قیمت.`,
          confidence: Math.max(45, d.confidenceScore - 15),
          expectedImpact: 'هشدار فرصت بدون تعهد فوری',
          riskImpact: 'صفر تا زمان ورود',
        });
      }
    }

    if (d.carsToSell.length && ctx.watchlistIds.size) {
      for (const c of d.carsToSell) {
        if (ctx.watchlistIds.has(c.carId)) {
          push({
            actionType: 'WATCHLIST_REMOVE',
            priority: 3,
            relatedCars: [c.carId],
            reason: 'خروج از واچ‌لیست پس از فروش/عدم‌هم‌راستایی با سیگنال.',
            confidence: 55,
            expectedImpact: 'کاهش نویز هشدار',
            riskImpact: 'ندارد',
          });
        }
      }
    }

    const tuned = this.applyAdaptiveTuning(actions, ctx.adaptive);
    tuned.sort((a, b) => b.priority - a.priority);

    const dedup = new Map<ExecutionActionType, ExecutionAction>();
    for (const a of tuned) {
      const prev = dedup.get(a.actionType);
      if (!prev || a.priority > prev.priority) dedup.set(a.actionType, a);
    }
    return [...dedup.values()].sort((a, b) => b.priority - a.priority);
  }

  private summarize(
    actions: ExecutionAction[],
    d: DecisionSummaryPayload,
    briefing?: string,
  ): string {
    if (!actions.length) return d.explanation.slice(0, 800);
    const top = actions
      .slice(0, 4)
      .map((a) => `${a.actionType} (p${a.priority}): ${a.reason.slice(0, 120)}`)
      .join(' \n');
    const intro = briefing ? `${briefing.slice(0, 300)}\n\n` : '';
    return `${intro}پلان اجرای پیشنهادی:\n${top}\n\n${d.explanation.slice(0, 400)}`;
  }

  async buildPlan(options: {
    userId?: string;
    persist?: boolean;
  }): Promise<ExecutionPlanResult> {
    const ctx = await this.loadContext(options.userId);
    const actions = this.composeActions(ctx);

    const port = ctx.unified.portfolio as {
      expectedReturn?: number;
      expectedVolatility?: number;
      expectedDrawdown?: number;
    } | null;
    const bp = ctx.unified.bestPortfolio as {
      expectedReturn?: number;
      expectedVolatility?: number;
      sharpeRatio?: number | null;
    } | null;

    const sim = this.simulationFrom(
      ctx.rebalance,
      ctx.stressHint,
      bp,
      port,
    );

    const planDate = fmtDate(utcToday());
    let expectedReturn: number | null = null;
    let expectedRisk: number | null = null;
    if (ctx.rebalance?.ok && ctx.rebalance.optimalSnapshot) {
      expectedReturn = ctx.rebalance.optimalSnapshot.expectedReturn ?? null;
      expectedRisk = ctx.rebalance.optimalSnapshot.expectedVolatility ?? null;
    } else if (bp) {
      expectedReturn = bp.expectedReturn ?? null;
      expectedRisk = bp.expectedVolatility ?? null;
    } else if (ctx.lastOpt) {
      expectedReturn = ctx.lastOpt.expectedReturn;
      expectedRisk = ctx.lastOpt.expectedVolatility;
    }

    const bat = ctx.unified.risk?.liveBattery as LiveBattery | undefined;
    const summary = this.summarize(
      actions,
      ctx.decision,
      typeof ctx.unified.briefing === 'string' ? ctx.unified.briefing : undefined,
    );

    let persistedId: string | null = null;
    if (options.persist) {
      const row = await this.prisma.executionPlan.create({
        data: {
          userId: options.userId?.trim() ?? null,
          planDate: utcToday(),
          actions: actions as unknown as Prisma.InputJsonValue,
          summary,
          expectedReturn,
          expectedRisk,
          confidence: ctx.decision.confidenceScore,
          simulation: sim as unknown as Prisma.InputJsonValue,
        },
      });
      persistedId = row.id;
    }

    return {
      planDate,
      userId: options.userId?.trim() ?? null,
      actions,
      summary,
      expectedReturn,
      expectedRisk,
      confidence: ctx.decision.confidenceScore,
      simulation: sim,
      sources: {
        intelligenceOverview: true,
        briefing: ctx.unified.briefing,
        marketCycle: ctx.unified.market?.marketCycle,
        segmentTrendsSample: Array.isArray(ctx.unified.market?.segmentTrends)
          ? (ctx.unified.market.segmentTrends as unknown[]).slice(0, 6)
          : [],
        stressLiveBatteryScenarios: bat?.results?.length ?? 0,
        stressWorstDrawdownScenario: ctx.stressHint?.scenarioId ?? null,
        triggerSampleSize: ctx.recentTriggers.length,
        lastOptimizationId: ctx.lastOpt?.id ?? null,
        rebalanceOk: ctx.rebalance?.ok ?? false,
        adaptiveTuning: {
          riskBlend: ctx.adaptive.scoring.risk,
          decisionScale: ctx.adaptive.decisionConf.scale,
          volatilityTriggerThreshold: ctx.adaptive.triggerThresholds.volatility_spike,
        },
        adaptiveSelectionKeys: Object.keys(ctx.adaptiveModels ?? {}).slice(0, 12),
        bestPortfolioMethodology: bp && 'methodology' in (bp as object)
          ? (bp as { methodology?: string }).methodology
          : null,
        strategyPrimary: ctx.strategyAdvice.primary?.key ?? null,
        marketOutlook: ctx.decision.marketOutlook,
        riskLevel: ctx.decision.riskLevel,
      },
      persistedId,
    };
  }

  async listHistory(options: { userId?: string; limit: number }) {
    return this.prisma.executionPlan.findMany({
      where: options.userId ? { userId: options.userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
    });
  }

  async listPlans(options: { userId?: string; limit: number }) {
    const take = Math.min(Math.max(options.limit, 1), 200);
    return this.prisma.executionPlan.findMany({
      where: options.userId ? { userId: options.userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        simulations: { orderBy: { createdAt: 'desc' }, take: 1 },
        results: { orderBy: { executedAt: 'desc' }, take: 4 },
        approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });
  }

  async getPlanById(id: string) {
    return this.prisma.executionPlan.findUnique({
      where: { id },
      include: {
        simulations: { orderBy: { createdAt: 'desc' }, take: 3 },
        results: { orderBy: { executedAt: 'desc' }, take: 12 },
        approvals: { orderBy: { createdAt: 'desc' }, take: 6 },
      },
    });
  }

  async listResults(options: { userId?: string; limit: number }) {
    const take = Math.min(Math.max(options.limit, 1), 500);
    return this.prisma.executionResult.findMany({
      where: options.userId ? { userId: options.userId } : undefined,
      orderBy: { executedAt: 'desc' },
      take,
    });
  }
}
