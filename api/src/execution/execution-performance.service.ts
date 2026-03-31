import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExecutionPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [total, executed, failed, skipped] = await Promise.all([
      this.prisma.executionResult.count(),
      this.prisma.executionResult.count({ where: { status: 'EXECUTED' } }),
      this.prisma.executionResult.count({ where: { status: 'FAILED' } }),
      this.prisma.executionResult.count({ where: { status: 'SKIPPED' } }),
    ]);

    const agg = await this.prisma.executionResult.aggregate({
      where: { status: 'EXECUTED' },
      _avg: {
        expectedReturn: true,
        realizedReturn: true,
        expectedRisk: true,
        realizedRisk: true,
      },
    });

    const err =
      agg._avg.expectedReturn != null &&
      agg._avg.realizedReturn != null &&
      Number.isFinite(agg._avg.expectedReturn - agg._avg.realizedReturn)
        ? Math.abs(agg._avg.expectedReturn - agg._avg.realizedReturn)
        : null;

    return {
      totalResults: total,
      executed,
      failed,
      skipped,
      successRate: total ? executed / total : 0,
      avgExpectedReturn: agg._avg.expectedReturn,
      avgRealizedReturn: agg._avg.realizedReturn,
      avgExpectedRisk: agg._avg.expectedRisk,
      avgRealizedRisk: agg._avg.realizedRisk,
      meanAbsoluteExpectedRealizedError: err,
    };
  }

  async byActionType() {
    const rows = await this.prisma.executionResult.groupBy({
      by: ['actionType', 'status'],
      _count: { id: true },
      _avg: { realizedReturn: true, expectedReturn: true },
    });
    return rows.map((r) => ({
      actionType: r.actionType,
      status: r.status,
      count: r._count.id,
      avgRealized: r._avg.realizedReturn,
      avgExpected: r._avg.expectedReturn,
    }));
  }

  async byStrategy() {
    const rows = await this.prisma.executionResult.findMany({
      take: 500,
      orderBy: { executedAt: 'desc' },
      select: { metadata: true, realizedReturn: true, expectedReturn: true },
    });
    const by = new Map<
      string,
      { n: number; ret: number; exp: number }
    >();
    for (const r of rows) {
      const m = r.metadata as { strategyKey?: string } | null;
      const k = m?.strategyKey ?? 'unknown';
      const cur = by.get(k) ?? { n: 0, ret: 0, exp: 0 };
      cur.n += 1;
      cur.ret += r.realizedReturn ?? 0;
      cur.exp += r.expectedReturn ?? 0;
      by.set(k, cur);
    }
    return [...by.entries()].map(([strategyKey, v]) => ({
      strategyKey,
      count: v.n,
      avgRealized: v.n ? v.ret / v.n : null,
      avgExpected: v.n ? v.exp / v.n : null,
    }));
  }

  async byMarketCycle() {
    const rows = await this.prisma.executionResult.findMany({
      take: 400,
      orderBy: { executedAt: 'desc' },
      select: { metadata: true, realizedReturn: true },
    });
    const by = new Map<string, { n: number; sum: number }>();
    for (const r of rows) {
      const m = r.metadata as { marketOutlook?: string } | null;
      const k = m?.marketOutlook ?? 'unknown';
      const cur = by.get(k) ?? { n: 0, sum: 0 };
      cur.n += 1;
      cur.sum += r.realizedReturn ?? 0;
      by.set(k, cur);
    }
    return [...by.entries()].map(([cycle, v]) => ({
      marketOutlook: cycle,
      count: v.n,
      avgRealized: v.n ? v.sum / v.n : null,
    }));
  }

  /** کالیبراسیون تقریبی: نرخ موفقیت به‌ازای بازهٔ confidence */
  async confidenceCalibration(buckets = [40, 55, 70, 85]) {
    const rows = await this.prisma.executionResult.findMany({
      where: { status: 'EXECUTED' },
      take: 2000,
      select: { metadata: true, realizedReturn: true },
    });
    const out: Array<{
      from: number;
      to: number;
      count: number;
      successRate: number;
    }> = [];
    for (let i = 0; i < buckets.length; i++) {
      const lo = buckets[i]!;
      const hi = buckets[i + 1] ?? 100;
      const slice = rows.filter((r) => {
        const c = (r.metadata as { confidence?: number } | null)?.confidence;
        return typeof c === 'number' && c >= lo && c < hi;
      });
      const ok = slice.filter(
        (r) => (r.realizedReturn ?? 0) > -1e-6,
      ).length;
      out.push({
        from: lo,
        to: hi,
        count: slice.length,
        successRate: slice.length ? ok / slice.length : 0,
      });
    }
    return out;
  }

  async decisionImpact() {
    const recent = await this.prisma.executionPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        results: {
          orderBy: { executedAt: 'desc' },
          take: 3,
        },
      },
    });
    return recent.map((p) => ({
      planId: p.id,
      userId: p.userId,
      planDate: p.planDate,
      actionCount: Array.isArray(p.actions) ? p.actions.length : 0,
      results: p.results.map((r) => ({
        actionType: r.actionType,
        status: r.status,
        expectedReturn: r.expectedReturn,
        realizedReturn: r.realizedReturn,
      })),
    }));
  }
}
