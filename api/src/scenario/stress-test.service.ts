import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScenarioSimulationService, type PortfolioInput } from './scenario-simulation.service';

/** شناسهٔ سناریوهای استاندارد استرس (باید در DB باشد) */
export const STANDARD_STRESS_SCENARIO_IDS = [
  'scen_drop_10',
  'scen_drop_20',
  'scen_drop_30',
  'scen_liquidity_half',
  'scen_vol_double',
  'scen_demand_collapse',
  'scen_segment_crash',
  'scen_market_crash',
  'scen_prediction_error',
] as const;

@Injectable()
export class StressTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scenarioSim: ScenarioSimulationService,
  ) {}

  async runStressTest(
    portfolio: PortfolioInput,
    scenarioId: string,
    options?: { paths?: number; persist?: boolean },
  ) {
    const run = await this.scenarioSim.runScenario(
      portfolio,
      scenarioId,
      { paths: options?.paths },
    );
    let saved = null;
    if (options?.persist !== false) {
      saved = await this.prisma.portfolioStressTest.create({
        data: {
          portfolio: portfolio as unknown as Prisma.InputJsonValue,
          scenarioId,
          finalReturn: run.finalReturn.mean,
          maxDrawdown: run.maxDrawdown.mean,
          recoveryTimeDays: run.timeToRecovery.medianDays,
          lossProbability: run.lossProbability,
          volatility: run.volatility,
          worstCase: run.finalReturn.worstCase,
          bestCase: run.finalReturn.bestCase,
          survivalProbability: run.survivalProbability,
          raw: run as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return { run, savedId: saved?.id ?? null };
  }

  async runStandardBattery(
    portfolio: PortfolioInput,
    options?: { paths?: number; persist?: boolean; extraScenarioIds?: string[] },
  ) {
    const ids = [
      ...STANDARD_STRESS_SCENARIO_IDS,
      ...(options?.extraScenarioIds ?? []),
    ];
    const results: Array<{
      scenarioId: string;
      run: Awaited<ReturnType<ScenarioSimulationService['runScenario']>>;
      savedId: string | null;
    }> = [];
    for (const sid of ids) {
      const ex = await this.prisma.marketScenario.findUnique({
        where: { id: sid },
      });
      if (!ex) continue;
      const r = await this.runStressTest(portfolio, sid, options);
      results.push({
        scenarioId: sid,
        run: r.run,
        savedId: r.savedId,
      });
    }
    return { portfolio, count: results.length, results };
  }
}
