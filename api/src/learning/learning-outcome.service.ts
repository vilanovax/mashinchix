import { Injectable, Logger } from '@nestjs/common';
import {
  DecisionMarketAction,
  LearningHorizon,
  LearningModelFamily,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addCalendarDays,
  priceOnOrAfter,
  priceOnOrBeforeDb,
  startOfUtcDay,
  subCalendarDays,
} from '../model-evaluation/eval-price.util';
import { avgSegmentIndexReturnPct } from './learning-benchmark.util';
import { toNumber } from '../common/decimal.util';

const HORIZON_DAYS: Record<LearningHorizon, number> = {
  D7: 7,
  D30: 30,
  D90: 90,
};

function rewardFromReturn(
  returnPct: number,
  rank: number,
  clicked: boolean,
  saved: boolean,
): number {
  const base = Math.max(-40, Math.min(40, returnPct * 180));
  const rankBonus = rank <= 2 ? 6 - rank * 2 : 0;
  const engagement = (clicked ? 4 : 0) + (saved ? 6 : 0);
  return base + rankBonus + engagement;
}

function parseBestCarIds(details: unknown): string[] {
  if (!details || typeof details !== 'object') return [];
  const raw = (details as { bestCarsToBuy?: unknown }).bestCarsToBuy;
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const x of raw) {
    if (x && typeof x === 'object' && 'carId' in x) {
      const id = (x as { carId: string }).carId;
      if (typeof id === 'string') ids.push(id);
    }
  }
  return ids;
}

@Injectable()
export class LearningOutcomeService {
  private readonly logger = new Logger(LearningOutcomeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncRecommendationOutcomes(maxRows = 600): Promise<{ created: number }> {
    const today = startOfUtcDay(new Date());
    let created = 0;
    const results = await this.prisma.recommendationResult.findMany({
      where: {
        recommendationSession: {
          createdAt: { lte: subCalendarDays(today, 100) },
        },
      },
      include: { recommendationSession: true },
      take: maxRows,
      orderBy: { createdAt: 'asc' },
    });

    for (const r of results) {
      const base = r.recommendationSession.createdAt;
      const ageDays =
        (today.getTime() - startOfUtcDay(base).getTime()) / 86_400_000;
      const modelVersion = r.recommendationSession.modelVersion;

      for (const horizon of [
        LearningHorizon.D7,
        LearningHorizon.D30,
        LearningHorizon.D90,
      ] as const) {
        const need = HORIZON_DAYS[horizon];
        if (ageDays < need + 0.5) continue;

        const exists = await this.prisma.recommendationOutcome.findUnique({
          where: {
            recommendationResultId_horizon: {
              recommendationResultId: r.id,
              horizon,
            },
          },
        });
        if (exists) continue;

        const p0 = await priceOnOrBeforeDb(this.prisma, r.carId, base);
        const p1 = await priceOnOrAfter(
          this.prisma,
          r.carId,
          addCalendarDays(base, need),
        );
        if (p0 == null || p1 == null || p0 <= 0) continue;

        const returnPct = p1 / p0 - 1;
        const rewardScore = rewardFromReturn(
          returnPct,
          r.rank,
          r.wasClicked,
          r.wasSaved,
        );
        await this.prisma.recommendationOutcome.create({
          data: {
            recommendationResultId: r.id,
            modelVersion,
            horizon,
            priceAtRecommendation: p0,
            priceAfter: p1,
            returnPct,
            rewardScore,
            metadata: {
              rank: r.rank,
              wasClicked: r.wasClicked,
              wasSaved: r.wasSaved,
            } as Prisma.InputJsonValue,
          },
        });
        created++;
      }
    }

    this.logger.log(`RecommendationOutcome rows created: ${created}`);
    return { created };
  }

  async syncDecisionOutcomes(maxSnapshots = 120): Promise<{ created: number }> {
    const today = startOfUtcDay(new Date());
    let created = 0;

    const snaps = await this.prisma.decisionSnapshot.findMany({
      where: {
        userId: null,
        snapshotDate: { lte: subCalendarDays(today, 100) },
      },
      orderBy: { snapshotDate: 'desc' },
      take: maxSnapshots * 3,
    });

    for (const s of snaps) {
      const base = s.snapshotDate;
      const daysSince =
        (today.getTime() - startOfUtcDay(base).getTime()) / 86_400_000;

      for (const horizon of [
        LearningHorizon.D7,
        LearningHorizon.D30,
        LearningHorizon.D90,
      ] as const) {
        const need = HORIZON_DAYS[horizon];
        if (daysSince < need + 0.5) continue;

        const exists = await this.prisma.decisionOutcome.findUnique({
          where: {
            decisionSnapshotId_horizon: {
              decisionSnapshotId: s.id,
              horizon,
            },
          },
        });
        if (exists) continue;

        const bench = await avgSegmentIndexReturnPct(
          this.prisma,
          base,
          need,
        );
        const carIds = parseBestCarIds(s.details);
        const rets: number[] = [];
        for (const cid of carIds.slice(0, 8)) {
          const p0 = await priceOnOrBeforeDb(this.prisma, cid, base);
          const p1 = await priceOnOrAfter(
            this.prisma,
            cid,
            addCalendarDays(base, need),
          );
          if (p0 != null && p1 != null && p0 > 0) rets.push(p1 / p0 - 1);
        }
        const decisionReturnProxyPct = rets.length
          ? rets.reduce((a, b) => a + b, 0) / rets.length
          : null;

        let success: boolean | null = null;
        if (bench != null && decisionReturnProxyPct != null) {
          if (s.marketDecision === DecisionMarketAction.BUY) {
            success = decisionReturnProxyPct > bench;
          } else if (s.marketDecision === DecisionMarketAction.SELL) {
            success = decisionReturnProxyPct < bench;
          } else {
            success =
              Math.abs(decisionReturnProxyPct - bench) <
              Math.max(0.003, Math.abs(bench) * 0.25);
          }
        }

        const rewardScore =
          bench != null && decisionReturnProxyPct != null
            ? Math.max(
                -35,
                Math.min(35, (decisionReturnProxyPct - bench) * 160),
              )
            : null;

        await this.prisma.decisionOutcome.create({
          data: {
            decisionSnapshotId: s.id,
            horizon,
            benchmarkReturnPct: bench ?? undefined,
            decisionReturnProxyPct: decisionReturnProxyPct ?? undefined,
            success: success ?? undefined,
            rewardScore: rewardScore ?? undefined,
            metadata: {
              marketDecision: s.marketDecision,
              carsUsed: carIds.length,
            } as Prisma.InputJsonValue,
          },
        });
        created++;
      }
    }

    this.logger.log(`DecisionOutcome rows created: ${created}`);
    return { created };
  }

  async syncPortfolioOutcomes(maxRecs = 100): Promise<{ created: number }> {
    let created = 0;
    const today = startOfUtcDay(new Date());
    const recs = await this.prisma.userPortfolioRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: maxRecs,
    });

    for (const rec of recs) {
      const base = rec.createdAt;
      const daysSince =
        (today.getTime() - startOfUtcDay(base).getTime()) / 86_400_000;
      const parsed = this.parsePortfolioCars(rec.result);
      if (!parsed.length) continue;

      for (const horizon of [
        LearningHorizon.D7,
        LearningHorizon.D30,
        LearningHorizon.D90,
      ] as const) {
        const need = HORIZON_DAYS[horizon];
        if (daysSince < need + 0.5) continue;

        const exists = await this.prisma.portfolioOutcome.findUnique({
          where: {
            referenceKind_referenceId_horizon: {
              referenceKind: 'user_portfolio_rec',
              referenceId: rec.id,
              horizon,
            },
          },
        });
        if (exists) continue;

        let wRet = 0;
        let wSum = 0;
        for (const { carId, weight } of parsed) {
          const p0 = await priceOnOrBeforeDb(this.prisma, carId, base);
          const p1 = await priceOnOrAfter(
            this.prisma,
            carId,
            addCalendarDays(base, need),
          );
          if (p0 != null && p1 != null && p0 > 0 && weight > 0) {
            wRet += weight * (p1 / p0 - 1);
            wSum += weight;
          }
        }
        if (wSum < 1e-6) continue;

        const returnPct = wRet / wSum;
        const benchmarkReturnPct = await avgSegmentIndexReturnPct(
          this.prisma,
          base,
          need,
        );
        const rewardScore =
          benchmarkReturnPct != null
            ? Math.max(
                -40,
                Math.min(40, (returnPct - benchmarkReturnPct) * 150),
              )
            : Math.max(-40, Math.min(40, returnPct * 120));

        await this.prisma.portfolioOutcome.create({
          data: {
            userId: rec.userId,
            referenceKind: 'user_portfolio_rec',
            referenceId: rec.id,
            horizon,
            returnPct,
            benchmarkReturnPct: benchmarkReturnPct ?? undefined,
            rewardScore,
            metadata: { weights: parsed.length } as Prisma.InputJsonValue,
          },
        });
        created++;
      }
    }

    this.logger.log(`PortfolioOutcome rows created: ${created}`);
    return { created };
  }

  async syncStrategyOutcomes(): Promise<{ upserted: number }> {
    const latestByStrategy = await this.prisma.backtestResult.groupBy({
      by: ['strategyName'],
      _max: { endDate: true },
    });

    let upserted = 0;
    const returns: number[] = [];

    for (const g of latestByStrategy) {
      const row = await this.prisma.backtestResult.findFirst({
        where: {
          strategyName: g.strategyName,
          endDate: g._max.endDate ?? undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (row?.totalReturn != null) returns.push(row.totalReturn);
    }

    returns.sort((a, b) => a - b);
    const median =
      returns.length === 0
        ? 0
        : returns[Math.floor(returns.length / 2)] ?? 0;

    for (const g of latestByStrategy) {
      const row = await this.prisma.backtestResult.findFirst({
        where: {
          strategyName: g.strategyName,
          endDate: g._max.endDate ?? undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) continue;

      const vsMedianPeer =
        row.totalReturn != null ? row.totalReturn - median : null;
      const rankAmongPeers =
        row.totalReturn != null
          ? returns.filter((x) => x > row.totalReturn!).length + 1
          : null;
      const rewardScore =
        row.totalReturn != null
          ? Math.max(-20, Math.min(20, (row.totalReturn - median) * 40))
          : null;

      await this.prisma.strategyOutcome.upsert({
        where: {
          strategyName_periodEnd: {
            strategyName: row.strategyName,
            periodEnd: row.endDate,
          },
        },
        create: {
          strategyName: row.strategyName,
          periodStart: row.startDate,
          periodEnd: row.endDate,
          totalReturn: row.totalReturn ?? undefined,
          annualReturn: row.annualReturn ?? undefined,
          maxDrawdown: row.maxDrawdown ?? undefined,
          vsMedianPeer: vsMedianPeer ?? undefined,
          rankAmongPeers: rankAmongPeers ?? undefined,
          rewardScore: rewardScore ?? undefined,
          sampleTrades: row.tradesCount ?? undefined,
        },
        update: {
          totalReturn: row.totalReturn ?? undefined,
          annualReturn: row.annualReturn ?? undefined,
          maxDrawdown: row.maxDrawdown ?? undefined,
          vsMedianPeer: vsMedianPeer ?? undefined,
          rankAmongPeers: rankAmongPeers ?? undefined,
          rewardScore: rewardScore ?? undefined,
          sampleTrades: row.tradesCount ?? undefined,
        },
      });
      upserted++;
    }

    this.logger.log(`StrategyOutcome upserted: ${upserted}`);
    return { upserted };
  }

  async syncSignalPerformance(): Promise<{ upserted: number }> {
    const rows = await this.prisma.investmentScoreEvaluation.findMany({
      where: { return30d: { not: null } },
      take: 12_000,
      orderBy: { snapshotDate: 'desc' },
      include: {
        car: {
          select: {
            marketData: { select: { marketSignal: true } },
          },
        },
      },
    });

    const groups = new Map<string, number[]>();
    let minD: Date | undefined;
    let maxD: Date | undefined;
    for (const r of rows) {
      const sig = r.car.marketData?.marketSignal?.toUpperCase() ?? 'UNKNOWN';
      const arr = groups.get(sig) ?? [];
      arr.push(r.return30d!);
      groups.set(sig, arr);
      if (minD == null || r.snapshotDate < minD) minD = r.snapshotDate;
      if (maxD == null || r.snapshotDate > maxD) maxD = r.snapshotDate;
    }

    if (minD == null || maxD == null) return { upserted: 0 };

    let upserted = 0;
    for (const [signalKey, rets] of groups) {
      const sampleCount = rets.length;
      const successCount = rets.filter((x) => x > 0).length;
      const avgForwardReturn =
        rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
      const winRate = sampleCount ? successCount / sampleCount : 0;
      const rewardScore = Math.max(-25, Math.min(25, avgForwardReturn * 120));

      await this.prisma.signalPerformance.upsert({
        where: {
          signalKey_horizon_periodStart_periodEnd: {
            signalKey,
            horizon: LearningHorizon.D30,
            periodStart: minD,
            periodEnd: maxD,
          },
        },
        create: {
          signalKey,
          horizon: LearningHorizon.D30,
          periodStart: minD,
          periodEnd: maxD,
          sampleCount,
          successCount,
          avgForwardReturn,
          winRate,
          rewardScore,
          metadata: { source: 'investmentScoreEvaluation' } as Prisma.InputJsonValue,
        },
        update: {
          sampleCount,
          successCount,
          avgForwardReturn,
          winRate,
          rewardScore,
          metadata: { source: 'investmentScoreEvaluation' } as Prisma.InputJsonValue,
        },
      });
      upserted++;
    }

    this.logger.log(`SignalPerformance upserted: ${upserted}`);
    return { upserted };
  }

  /**
   * یادگیری از ExecutionResult: ExecutionOutcome، PortfolioOutcome، ModelPerformanceHistory.
   */
  async ingestExecutionResults(planId: string): Promise<{ outcomes: number }> {
    const results = await this.prisma.executionResult.findMany({
      where: { planId, status: 'EXECUTED' },
    });
    const periodEnd = startOfUtcDay(new Date());
    const periodStart = subCalendarDays(periodEnd, 30);
    let outcomes = 0;

    for (const r of results) {
      const exp = r.expectedReturn ?? 0;
      const real = r.realizedReturn ?? 0;
      const riskPen = (r.realizedRisk ?? 0) - (r.expectedRisk ?? 0);
      const reward = real - exp * 0.15 - Math.max(0, riskPen) * 0.1;
      const success = real > exp - 0.02;

      await this.prisma.executionOutcome.upsert({
        where: { executionResultId: r.id },
        create: {
          executionResultId: r.id,
          horizon: LearningHorizon.D30,
          expectedReturn: exp,
          realizedReturn: real,
          success,
          rewardScore: reward,
          riskPenalty: riskPen,
          metadata: {
            actionType: r.actionType,
            planId: r.planId,
          } as Prisma.InputJsonValue,
        },
        update: {
          expectedReturn: exp,
          realizedReturn: real,
          success,
          rewardScore: reward,
          riskPenalty: riskPen,
        },
      });
      outcomes += 1;

      await this.prisma.portfolioOutcome.upsert({
        where: {
          referenceKind_referenceId_horizon: {
            referenceKind: 'EXECUTION',
            referenceId: r.id,
            horizon: LearningHorizon.D30,
          },
        },
        create: {
          userId: r.userId,
          referenceKind: 'EXECUTION',
          referenceId: r.id,
          horizon: LearningHorizon.D30,
          returnPct: real,
          benchmarkReturnPct: exp,
          rewardScore: reward,
          metadata: { actionType: r.actionType } as Prisma.InputJsonValue,
        },
        update: {
          returnPct: real,
          benchmarkReturnPct: exp,
          rewardScore: reward,
        },
      });

      const existsHist = await this.prisma.modelPerformanceHistory.findFirst({
        where: {
          modelFamily: LearningModelFamily.EXECUTION,
          modelKey: r.actionType,
          periodEnd,
          metricName: 'realized_return_proxy',
        },
      });
      if (!existsHist) {
        await this.prisma.modelPerformanceHistory.create({
          data: {
            modelFamily: LearningModelFamily.EXECUTION,
            modelKey: r.actionType,
            metricName: 'realized_return_proxy',
            metricValue: real,
            sampleSize: 1,
            periodStart,
            periodEnd,
            metadata: {
              expectedReturn: exp,
              planId,
              executionResultId: r.id,
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    return { outcomes };
  }

  private parsePortfolioCars(
    result: unknown,
  ): Array<{ carId: string; weight: number }> {
    if (!result || typeof result !== 'object') return [];
    const cars = (result as { cars?: Array<{ carId?: string; weight?: number }> })
      .cars;
    if (!cars?.length) return [];
    const out: Array<{ carId: string; weight: number }> = [];
    for (const c of cars) {
      const w = toNumber(c.weight);
      if (c.carId != null && w != null && w > 0) {
        out.push({ carId: c.carId, weight: w });
      }
    }
    return out;
  }
}
