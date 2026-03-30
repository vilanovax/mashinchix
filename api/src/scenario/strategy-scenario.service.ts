import { Injectable, Logger } from '@nestjs/common';
import { BacktestStrategyName, MarketScenario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildStrategyContext } from '../backtesting/backtesting-context';
import { runEquitySimulation } from '../backtesting/equity.engine';
import { metricsFromPath } from './scenario-math.util';

export function shockHistoricalEquity(
  equity: number[],
  scenario: MarketScenario,
): number[] {
  if (equity.length < 2) return equity;
  const e0 = equity[0] || 1;
  const norm = equity.map((x) => x / e0);
  const n = norm.length;
  const driftPerStep = (scenario.priceChangePct / 100) / Math.max(1, n - 1);
  const out: number[] = [1];
  for (let i = 1; i < n; i++) {
    const r0 = norm[i]! / norm[i - 1]! - 1;
    let r = r0 * scenario.volatilityMultiplier + driftPerStep;
    r += (scenario.demandMultiplier - 1) * 0.0018;
    let v = out[i - 1]! * (1 + r);
    v *= 1 - (1 - scenario.liquidityMultiplier) * 0.00025;
    out.push(Math.max(1e-9, v));
  }
  return out;
}

@Injectable()
export class StrategyScenarioService {
  private readonly logger = new Logger(StrategyScenarioService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateStrategyUnderScenario(
    strategy: BacktestStrategyName,
    scenario: MarketScenario,
    start: Date,
    end: Date,
  ): Promise<{
    finalReturn: number;
    maxDrawdown: number;
    survivalProbability: number;
    timeToRecoveryDays: number | null;
  }> {
    const ctx = await buildStrategyContext(this.prisma, start, end);
    const eq = runEquitySimulation(strategy, ctx);
    const shocked = shockHistoricalEquity(eq.equity, scenario);
    const m = metricsFromPath(shocked);
    const survival = m.finalReturn > -0.25 ? 1 : 0;
    return {
      finalReturn: m.finalReturn,
      maxDrawdown: m.maxDrawdown,
      survivalProbability: survival,
      timeToRecoveryDays: m.recoveryDays,
    };
  }

  async recomputeAllStrategyScenarioRows(options?: {
    historyDays?: number;
  }): Promise<{ upserted: number }> {
    const days = options?.historyDays ?? 210;
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);

    const scenarios = await this.prisma.marketScenario.findMany();
    const strategies = Object.values(BacktestStrategyName).filter(
      (s) => s !== BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL,
    );

    let n = 0;
    for (const scenario of scenarios) {
      for (const strategy of strategies) {
        try {
          const r = await this.evaluateStrategyUnderScenario(
            strategy,
            scenario,
            start,
            end,
          );
          await this.prisma.strategyScenarioPerformance.upsert({
            where: {
              strategyName_scenarioId: {
                strategyName: strategy,
                scenarioId: scenario.id,
              },
            },
            create: {
              strategyName: strategy,
              scenarioId: scenario.id,
              finalReturn: r.finalReturn,
              maxDrawdown: r.maxDrawdown,
              survivalProbability: r.survivalProbability,
              timeToRecoveryDays: r.timeToRecoveryDays,
              methodology: 'historical-path-shock-v1',
            },
            update: {
              finalReturn: r.finalReturn,
              maxDrawdown: r.maxDrawdown,
              survivalProbability: r.survivalProbability,
              timeToRecoveryDays: r.timeToRecoveryDays,
              methodology: 'historical-path-shock-v1',
            },
          });
          n++;
        } catch (e) {
          this.logger.warn(
            `skip strategy ${strategy} scenario ${scenario.id}: ${e}`,
          );
        }
      }
    }
    return { upserted: n };
  }

  async robustnessSummary() {
    const rows = await this.prisma.strategyScenarioPerformance.findMany({
      include: { scenario: { select: { id: true, name: true } } },
    });
    const byScenario = new Map<
      string,
      {
        scenarioName: string;
        best?: BacktestStrategyName;
        bestRet: number;
        worst?: BacktestStrategyName;
        worstRet: number;
      }
    >();
    for (const r of rows) {
      const fr = r.finalReturn ?? -1e9;
      const cur = byScenario.get(r.scenarioId) ?? {
        scenarioName: r.scenario.name,
        bestRet: -1e9,
        worstRet: 1e9,
      };
      cur.scenarioName = r.scenario.name;
      if (fr > cur.bestRet) {
        cur.bestRet = fr;
        cur.best = r.strategyName;
      }
      if (fr < cur.worstRet) {
        cur.worstRet = fr;
        cur.worst = r.strategyName;
      }
      byScenario.set(r.scenarioId, cur);
    }
    return {
      scenarios: [...byScenario.entries()].map(([id, v]) => ({
        scenarioId: id,
        ...v,
      })),
      rowCount: rows.length,
      note:
        rows.length === 0
          ? 'ابتدا POST /scenario/recompute-strategy-performance را اجرا کنید'
          : undefined,
    };
  }
}
