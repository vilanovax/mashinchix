import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceOverviewService } from '../intelligence/intelligence-overview.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { TriggerEngineService } from '../triggers/trigger-engine.service';
import { AdvisorPriorityService } from './advisor-priority.service';
import { AdvisorImpactService } from './advisor-impact.service';
import { AdvisorNarrativeService } from './advisor-narrative.service';
import { AdvisorHistoryService } from './advisor-history.service';
import { UserBehaviorService } from '../user-behavior/user-behavior.service';
import {
  ADVISOR_TITLE_FA,
  EXEC_TO_ADVISOR_TYPE,
  type AdvisorAction,
  type TodayActionPlanResponse,
} from './advisor.types';
import type { ExecutionAction } from '../execution/execution.types';

function utcToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** چرخهٔ بازار در Intelligence ممکن است آرایهٔ سگمنت‌ها باشد */
function marketCycleLabel(cycle: unknown): string | null {
  if (cycle == null) return null;
  if (typeof cycle === 'string') return cycle;
  if (Array.isArray(cycle)) {
    const parts = cycle
      .slice(0, 5)
      .map((row) => {
        if (row && typeof row === 'object') {
          const r = row as { segment?: string; cycleType?: string };
          return [r.segment, r.cycleType].filter(Boolean).join(':');
        }
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
  return null;
}

function worstDrawdownFromUnifiedRisk(risk: unknown): number | null {
  if (!risk || typeof risk !== 'object') return null;
  const live = (
    risk as {
      liveBattery?: {
        results?: Array<{ run?: { maxDrawdown?: { mean?: number } } }>;
      };
    }
  ).liveBattery;
  let worst = -1;
  for (const r of live?.results ?? []) {
    const m = r.run?.maxDrawdown?.mean;
    if (typeof m === 'number' && Number.isFinite(m) && m > worst) worst = m;
  }
  return worst >= 0 ? worst : null;
}

function opportunityScoreForAction(
  ex: ExecutionAction,
  opps: unknown[],
): number {
  if (!ex.relatedCars?.length) return 0.52;
  const ids = new Set<string>();
  if (Array.isArray(opps)) {
    for (const o of opps) {
      if (o && typeof o === 'object') {
        const car = (o as { car?: { id?: string } }).car;
        if (car?.id) ids.add(car.id);
      }
    }
  }
  let hit = 0;
  for (const c of ex.relatedCars) {
    if (ids.has(c)) hit++;
  }
  const r = hit / ex.relatedCars.length;
  return Math.min(1, 0.42 + r * 0.58);
}

type Unified = Awaited<
  ReturnType<IntelligenceOverviewService['getUnifiedOverview']>
>;

@Injectable()
export class UserActionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceOverviewService,
    private readonly execution: ExecutionEngineService,
    private readonly triggers: TriggerEngineService,
    private readonly priority: AdvisorPriorityService,
    private readonly impact: AdvisorImpactService,
    private readonly narrative: AdvisorNarrativeService,
    private readonly history: AdvisorHistoryService,
    private readonly userBehavior: UserBehaviorService,
  ) {}

  private carLabels(unified: Unified): Map<string, string> {
    const m = new Map<string, string>();
    for (const c of unified.decision.bestCarsToBuy ?? []) {
      m.set(c.carId, `${c.brand} ${c.model}`.trim());
    }
    for (const c of unified.decision.carsToSell ?? []) {
      m.set(c.carId, `${c.brand} ${c.model}`.trim());
    }
    for (const c of unified.bestCars ?? []) {
      if (!m.has(c.id)) {
        m.set(c.id, `${c.brand} ${c.model}`.trim());
      }
    }
    return m;
  }

  private buildWarnings(
    unified: Unified,
    userAlerts: Array<{ severity?: AlertSeverity }>,
    worstDd: number | null,
  ): string[] {
    const w: string[] = [];
    if (unified.decision.marketOutlook === 'BEAR') {
      w.push('چشم‌انداز بازار در فاز محتاط تا منفی دیده می‌شود.');
    }
    const ac = unified.market?.activeAlertsCount ?? 0;
    if (ac > 28) {
      w.push(`حجم هشدارهای فعال بازار بالاست (${ac}).`);
    }
    const highSev = userAlerts.filter(
      (e) => e.severity === AlertSeverity.HIGH,
    ).length;
    if (highSev > 1) {
      w.push(`${highSev} رویداد با شدت بالا به سبدی شما مربوط است.`);
    }
    if (worstDd != null && worstDd > 0.32) {
      w.push(
        `در سناریوهای استرس، افت ترکیبی تا حدود ${(worstDd * 100).toFixed(0)}٪ مدل شده است.`,
      );
    }
    return w;
  }

  private mapExecutionAction(
    ex: ExecutionAction,
    unified: Unified,
    plan: Awaited<ReturnType<ExecutionEngineService['buildPlan']>>,
    labels: Map<string, string>,
    factors: {
      urgency: number;
      riskReduction: number;
      adaptiveWeight: number;
      opportunityMax: number;
    },
  ): AdvisorAction {
    const advType = EXEC_TO_ADVISOR_TYPE[ex.actionType];
    const title = ADVISOR_TITLE_FA[advType];
    let description = ex.reason;
    if (ex.relatedCars?.length) {
      const names = ex.relatedCars
        .map((id) => labels.get(id) ?? id)
        .slice(0, 4)
        .join('، ');
      if (names) description = `${ex.reason}\nخودروهای مرتبط: ${names}.`;
    }
    const sim = plan.simulation ?? {};
    const impactScore = Math.min(
      1,
      0.28 +
        (ex.priority / 10) * 0.62 +
        (ex.actionType === 'REBALANCE_PORTFOLIO' &&
        sim.expectedReturnDelta != null
          ? 0.12
          : 0),
    );
    let opp = opportunityScoreForAction(ex, unified.opportunities as unknown[]);
    if (ex.actionType === 'BUY_CAR' || ex.actionType === 'INCREASE_RISK') {
      opp = Math.max(opp, factors.opportunityMax * 0.85);
    }
    if (ex.actionType === 'HOLD_POSITION' || ex.actionType === 'WATCHLIST_ADD') {
      opp = Math.min(opp, 0.55);
    }
    let riskR = factors.riskReduction;
    if (
      ex.actionType === 'SELL_CAR' ||
      ex.actionType === 'REDUCE_RISK' ||
      ex.actionType === 'MOVE_TO_CASH'
    ) {
      riskR = Math.min(1, riskR * 1.08);
    }
    if (ex.actionType === 'BUY_CAR' || ex.actionType === 'INCREASE_RISK') {
      riskR = Math.max(0.4, riskR * 0.88);
    }
    const priorityScore = this.priority.normalizedPriority({
      confidence: ex.confidence,
      impactScore,
      urgency: factors.urgency,
      riskReduction: riskR,
      opportunityScore: opp,
      adaptiveWeight: factors.adaptiveWeight,
    });
    const retHint =
      (sim.expectedReturnDelta ?? 0) / Math.max(1, plan.actions.length);
    const shHint =
      sim.sharpeImprovement != null
        ? sim.sharpeImprovement / Math.max(1, plan.actions.length)
        : null;
    return {
      type: advType,
      title,
      description,
      priority: ex.priority,
      priorityScore,
      confidence: ex.confidence,
      expectedImpact: {
        returnDeltaHint: Number(retHint.toFixed(6)),
        sharpeDeltaHint:
          shHint != null && Number.isFinite(shHint)
            ? Number(shHint.toFixed(6))
            : null,
        executionExpectedImpact: ex.expectedImpact ?? null,
        executionRiskImpact: ex.riskImpact ?? null,
      },
      metadata: {
        executionActionType: ex.actionType,
        relatedCars: ex.relatedCars ?? [],
        targetAllocation: ex.targetAllocation ?? null,
      },
    };
  }

  private maybeAddDiversify(
    unified: Unified,
    actions: AdvisorAction[],
  ): void {
    const hasRebalance = actions.some(
      (a) => a.type === 'REBALANCE_PORTFOLIO',
    );
    const cars = unified.portfolio?.cars as
      | Array<{ weight?: number }>
      | undefined;
    if (!cars?.length || hasRebalance) return;
    const maxW = Math.max(...cars.map((c) => Number(c.weight ?? 0)));
    const h = cars.reduce(
      (s, c) => s + (Number(c.weight ?? 0)) ** 2,
      0,
    );
    if (maxW <= 0.46 && h <= 0.4) return;
    const bestDiv = unified.bestPortfolio?.diversificationScore;
    actions.push({
      type: 'DIVERSIFY_PORTFOLIO',
      title: ADVISOR_TITLE_FA.DIVERSIFY_PORTFOLIO,
      description: `تمرکز بالا در چند دارایی (حداکثر وزن حدود ${(maxW * 100).toFixed(0)}٪). ${
        bestDiv != null
          ? `هدف تنوع نزدیک به الگوی بهینه (امتیاز تنوع مرجع حدود ${(Number(bestDiv) * 100).toFixed(0)}).`
          : 'گسترش بین سگمنت یا خودرو پیشنهاد می‌شود.'
      }`,
      priority: 5,
      priorityScore: 0.45,
      confidence: 58,
      expectedImpact: {
        diversificationGoal: bestDiv != null ? Number(bestDiv) : null,
        herfindahlProxy: Number(h.toFixed(4)),
      },
      metadata: { synthetic: true },
    });
  }

  async getTodayActionPlan(
    userId: string,
    persist = false,
  ): Promise<TodayActionPlanResponse> {
    const uid = userId.trim();
    const u = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد');

    const [unified, plan, userAlerts] = await Promise.all([
      this.intelligence.getUnifiedOverview(uid, { persist: false }),
      this.execution.buildPlan({ userId: uid, persist: false }),
      this.triggers.getUserAlerts(uid, 40),
    ]);

    const labels = this.carLabels(unified);
    const worstDd = worstDrawdownFromUnifiedRisk(unified.risk);
    const highSev = userAlerts.filter(
      (e) => e.severity === AlertSeverity.HIGH,
    ).length;
    let urgency = Math.min(
      1,
      0.28 +
        highSev * 0.14 +
        Math.min(0.42, (unified.market?.activeAlertsCount ?? 0) / 85),
    );
    const behaviorProf = await this.userBehavior.getProfileRow(uid);
    const panic = behaviorProf?.panicSellScore ?? 0;
    urgency = Math.min(1, urgency * (0.9 + 0.22 * panic));
    const riskReduction =
      worstDd != null
        ? Math.min(1, 0.38 + Math.min(0.52, worstDd * 1.05))
        : 0.5;
    const adaptiveWeight = await this.priority.adaptiveWeight(uid);
    const opArr = Array.isArray(unified.opportunities)
      ? unified.opportunities
      : [];
    const opportunityMax =
      opArr.length > 0 ? Math.min(1, 0.35 + opArr.length / 40) : 0.48;

    const factors = {
      urgency,
      riskReduction,
      adaptiveWeight,
      opportunityMax,
    };

    const recommendedActions = plan.actions.map((ex) =>
      this.mapExecutionAction(ex, unified, plan, labels, factors),
    );

    this.maybeAddDiversify(unified, recommendedActions);

    recommendedActions.sort((a, b) => b.priorityScore - a.priorityScore);
    recommendedActions.forEach((act, i) => {
      act.priority = Math.max(1, Math.min(10, 10 - i));
    });

    const expectedImpact = this.impact.aggregateFromPlanAndUnified(plan, {
      bestPortfolio: unified.bestPortfolio ?? null,
      portfolio: unified.portfolio as { cars?: Array<{ weight?: number }> } | null,
    });

    const warnings = this.buildWarnings(unified, userAlerts, worstDd);
    const opportunities = opArr.slice(0, 16);

    const topLabel =
      recommendedActions[0]?.title ??
      recommendedActions[0]?.type ??
      undefined;
    const { briefing, summaryFa, summaryEn } = this.narrative.build({
      marketCycle: marketCycleLabel(unified.market?.marketCycle),
      marketOutlook: unified.decision.marketOutlook,
      riskLevel: unified.decision.riskLevel,
      portfolioDecision: unified.decision.portfolioDecision,
      activeAlerts: unified.market?.activeAlertsCount ?? 0,
      opportunityCount: opArr.length,
      userAlertCount: userAlerts.length,
      topActionLabel: topLabel,
    });

    const marketState = [
      marketCycleLabel(unified.market?.marketCycle),
      unified.decision.marketOutlook,
    ]
      .filter(Boolean)
      .join(' · ');
    const portCars = unified.portfolio?.cars as unknown[] | undefined;
    const portfolioState = `${unified.decision.portfolioDecision} · ${portCars?.length ?? 0} نماد در سبد محور`;
    const riskState = unified.decision.riskLevel;

    let persistedId: string | null = null;
    if (persist) {
      const row = await this.history.persist({
        userId: uid,
        snapshotDate: utcToday(),
        marketState: marketState || null,
        portfolioState,
        riskState,
        actions: recommendedActions,
        expectedImpact,
        warnings,
        opportunities,
        confidence: plan.confidence,
        summary: summaryFa,
        briefing,
      });
      persistedId = row.id;
    }

    return {
      date: fmtDate(utcToday()),
      marketState: marketState || null,
      portfolioState,
      riskState,
      recommendedActions,
      expectedImpact,
      warnings,
      opportunities,
      confidence: plan.confidence,
      summary: summaryFa,
      briefing,
      summaryEnglish: summaryEn,
      persistedAdvisorSnapshotId: persistedId,
      sources: {
        executionPlanConfidence: plan.confidence,
        intelligenceSnapshotDate: unified.snapshotDate ?? null,
        userAlertsCount: userAlerts.length,
        opportunitiesCount: opArr.length,
      },
    };
  }
}
