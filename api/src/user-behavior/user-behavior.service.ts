import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function riskLevelToBase(rl: RiskLevel | null | undefined): number {
  if (rl === RiskLevel.LOW) return 0.35;
  if (rl === RiskLevel.HIGH) return 0.72;
  return 0.52;
}

@Injectable()
export class UserBehaviorService {
  constructor(private readonly prisma: PrismaService) {}

  async recordUserAction(input: {
    userId: string;
    actionType: string;
    planId?: string | null;
    executionId?: string | null;
    assetId?: string | null;
    action: string;
    value?: number | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const u = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد');

    const row = await this.prisma.userAction.create({
      data: {
        userId: input.userId,
        actionType: input.actionType,
        planId: input.planId ?? undefined,
        executionId: input.executionId ?? undefined,
        assetId: input.assetId ?? undefined,
        action: input.action,
        value: input.value ?? undefined,
        metadata: input.metadata ?? undefined,
      },
    });
    await this.updateBehaviorProfile(input.userId);
    return row;
  }

  async recordDecisionFeedback(input: {
    userId: string;
    decisionId: string;
    feedback: string;
    rating?: number | null;
    note?: string | null;
  }) {
    const [u, dec] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      }),
      this.prisma.decisionSnapshot.findUnique({
        where: { id: input.decisionId },
        select: { id: true },
      }),
    ]);
    if (!u) throw new NotFoundException('کاربر یافت نشد');
    if (!dec) throw new NotFoundException('تصمیم یافت نشد');

    const row = await this.prisma.userDecisionFeedback.create({
      data: {
        userId: input.userId,
        decisionId: input.decisionId,
        feedback: input.feedback,
        rating: input.rating ?? undefined,
        note: input.note ?? undefined,
      },
    });
    await this.updateBehaviorProfile(input.userId);
    return row;
  }

  async computeRiskTolerance(userId: string): Promise<number | null> {
    const profile = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });
    return profile?.riskTolerance ?? null;
  }

  async computePreferenceProfile(userId: string) {
    const p = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });
    return {
      segmentPreferences: (p?.segmentPreferences as Record<
        string,
        number
      > | null) ?? {},
      strategyPreferences: (p?.strategyPreferences as Record<
        string,
        number
      > | null) ?? {},
      momentumPref: p?.momentumPref ?? null,
      valuePref: p?.valuePref ?? null,
      diversificationPref: p?.diversificationPref ?? null,
      liquidityPref: p?.liquidityPref ?? null,
    };
  }

  async computeTrustScore(userId: string): Promise<number | null> {
    const p = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });
    return p?.confidenceTrust ?? null;
  }

  /** خواندن سریع بدون بازمحاسبهٔ کامل */
  async getProfileRow(userId: string) {
    return this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });
  }

  async getBehaviorProfile(userId: string) {
    await this.updateBehaviorProfile(userId);
    const row = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });
    return (
      row ?? {
        userId,
        riskTolerance: null,
        panicSellScore: null,
        holdDuration: null,
        diversificationPref: null,
        liquidityPref: null,
        momentumPref: null,
        valuePref: null,
        confidenceTrust: null,
        overrideRate: null,
        segmentPreferences: null,
        strategyPreferences: null,
      }
    );
  }

  async getPreferencesPayload(userId: string) {
    const p = await this.getBehaviorProfile(userId);
    return {
      userId,
      segmentPreferences: p.segmentPreferences ?? {},
      strategyPreferences: p.strategyPreferences ?? {},
      momentumPref: p.momentumPref,
      valuePref: p.valuePref,
      diversificationPref: p.diversificationPref,
      liquidityPref: p.liquidityPref,
      holdHorizonProxy: p.holdDuration,
    };
  }

  async getRiskProfilePayload(userId: string) {
    const p = await this.getBehaviorProfile(userId);
    return {
      userId,
      riskTolerance: p.riskTolerance,
      panicSellScore: p.panicSellScore,
      drawdownToleranceProxy:
        p.riskTolerance != null ? clamp(1.15 - p.riskTolerance, 0.2, 0.95) : null,
      confidenceTrust: p.confidenceTrust,
      overrideRate: p.overrideRate,
    };
  }

  /**
   * تجمیع از UserAction و UserDecisionFeedback و User.riskLevel
   */
  async updateBehaviorProfile(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { riskLevel: true },
    });
    if (!user) return;

    const [actions, feedbacks] = await Promise.all([
      this.prisma.userAction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
      this.prisma.userDecisionFeedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          decision: {
            select: {
              strategyDecision: true,
              riskLevel: true,
            },
          },
        },
      }),
    ]);

    const verbs = new Set(['ACCEPT', 'REJECT', 'MODIFY', 'IGNORE']);
    const filtered = actions.filter((a) => verbs.has(a.action));
    const n = filtered.length;
    const accept = filtered.filter((a) => a.action === 'ACCEPT').length;
    const reject = filtered.filter((a) => a.action === 'REJECT').length;
    const modify = filtered.filter((a) => a.action === 'MODIFY').length;
    const ignore = filtered.filter((a) => a.action === 'IGNORE').length;

    const confidenceTrust =
      n > 0
        ? clamp(0.22 + 0.78 * (accept / Math.max(1, accept + reject)), 0.08, 0.98)
        : null;
    const overrideRate = n > 0 ? clamp(modify / n, 0, 1) : null;

    const sellTyped = filtered.filter((a) =>
      /SELL|REDUCE|CASH/i.test(a.actionType),
    );
    const panicSellScore =
      sellTyped.length > 0
        ? clamp(
            sellTyped.filter((a) => a.action === 'REJECT').length /
              sellTyped.length,
            0,
            1,
          )
        : null;

    let holdSumMs = 0;
    let holdCnt = 0;
    const byAsset = new Map<string, Date[]>();
    for (const a of filtered) {
      if (a.action !== 'ACCEPT' || !a.assetId) continue;
      const arr = byAsset.get(a.assetId) ?? [];
      arr.push(a.createdAt);
      byAsset.set(a.assetId, arr);
    }
    for (const dates of byAsset.values()) {
      if (dates.length < 2) continue;
      const sorted = [...dates].sort((x, y) => x.getTime() - y.getTime());
      for (let i = 1; i < sorted.length; i++) {
        holdSumMs += sorted[i]!.getTime() - sorted[i - 1]!.getTime();
        holdCnt++;
      }
    }
    const holdDuration =
      holdCnt > 0
        ? holdSumMs / holdCnt / (86400 * 1000)
        : null;

    const rebalanceActs = filtered.filter((a) =>
      /REBALANCE|DIVERSIFY|OPTIMIZE/i.test(a.actionType),
    );
    const diversificationPref =
      rebalanceActs.length > 0
        ? clamp(
            rebalanceActs.filter((a) => a.action === 'ACCEPT').length /
              rebalanceActs.length,
            0,
            1,
          )
        : 0.48;

    const goodF = feedbacks.filter((f) => f.feedback === 'GOOD').length;
    const badF = feedbacks.filter((f) => f.feedback === 'BAD').length;
    const fbN = goodF + badF;
    const fbSignal = fbN > 0 ? (goodF - badF) / fbN : 0;

    let riskTolerance = riskLevelToBase(user.riskLevel);
    riskTolerance = clamp(riskTolerance + 0.12 * fbSignal, 0.12, 0.92);

    for (const f of feedbacks.slice(0, 80)) {
      if (
        f.feedback === 'BAD' &&
        (f.decision.riskLevel === RiskLevel.HIGH ||
          f.decision.riskLevel === RiskLevel.MEDIUM)
      ) {
        riskTolerance = clamp(riskTolerance - 0.04, 0.12, 0.92);
      }
      if (f.feedback === 'GOOD' && f.decision.riskLevel === RiskLevel.LOW) {
        riskTolerance = clamp(riskTolerance - 0.02, 0.12, 0.92);
      }
    }

    const momentumHints = filtered.filter(
      (a) =>
        a.action === 'ACCEPT' &&
        (/MOMENTUM|BUY_CAR|مومنتوم/i.test(a.actionType) ||
          (a.metadata &&
            JSON.stringify(a.metadata).toLowerCase().includes('momentum'))),
    ).length;
    const valueHints = filtered.filter(
      (a) =>
        a.action === 'ACCEPT' &&
        (/LOW_RISK|VALUE|کم‌ریسک/i.test(a.actionType) ||
          (a.metadata &&
            JSON.stringify(a.metadata).toLowerCase().includes('value'))),
    ).length;
    const hintDenom = Math.max(6, accept || 1);
    const momentumPref = clamp(0.35 + (momentumHints / hintDenom) * 0.4, 0, 1);
    const valuePref = clamp(0.35 + (valueHints / hintDenom) * 0.4, 0, 1);

    const liquidityAccept = filtered.filter(
      (a) =>
        a.action === 'ACCEPT' && /LIQUID|CASH|نقد/i.test(a.actionType),
    ).length;
    const liquidityPref = clamp(0.4 + (liquidityAccept / hintDenom) * 0.35, 0, 1);

    const segPref: Record<string, number> = {};
    const carIds = [
      ...new Set(
        actions.map((a) => a.assetId).filter((x): x is string => !!x),
      ),
    ];
    if (carIds.length) {
      const cars = await this.prisma.car.findMany({
        where: { id: { in: carIds.slice(0, 120) } },
        select: { id: true, segment: true },
      });
      const segByCar = new Map(cars.map((c) => [c.id, c.segment ?? '_']));
      for (const a of filtered) {
        if (!a.assetId || a.action !== 'ACCEPT') continue;
        const seg = segByCar.get(a.assetId) ?? '_';
        segPref[seg] = (segPref[seg] ?? 0) + 1;
      }
      const sMax = Math.max(1, ...Object.values(segPref));
      for (const k of Object.keys(segPref)) {
        segPref[k] = segPref[k]! / sMax;
      }
    }

    const stratPref: Record<string, number> = {};
    for (const f of feedbacks.slice(0, 100)) {
      const k = String(f.decision.strategyDecision);
      stratPref[k] = (stratPref[k] ?? 0) +
        (f.feedback === 'GOOD' ? 1 : f.feedback === 'BAD' ? -1 : 0);
    }
    for (const k of Object.keys(stratPref)) {
      stratPref[k] = clamp((stratPref[k]! + 3) / 6, 0, 1);
    }

    const existing = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });

    const payload = {
      riskTolerance,
      panicSellScore,
      holdDuration,
      diversificationPref,
      liquidityPref,
      momentumPref,
      valuePref,
      confidenceTrust,
      overrideRate,
      segmentPreferences: segPref as Prisma.JsonObject,
      strategyPreferences: stratPref as Prisma.JsonObject,
    };

    if (existing) {
      await this.prisma.userBehaviorProfile.update({
        where: { userId },
        data: payload,
      });
    } else {
      await this.prisma.userBehaviorProfile.create({
        data: {
          userId,
          ...payload,
        },
      });
    }
  }
}
