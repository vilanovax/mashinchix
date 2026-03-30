import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StressTestService, STANDARD_STRESS_SCENARIO_IDS } from './stress-test.service';
import { ScenarioSimulationService } from './scenario-simulation.service';
import { StrategyScenarioService } from './strategy-scenario.service';

@Injectable()
export class ScenarioAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stress: StressTestService,
    private readonly scenarioSim: ScenarioSimulationService,
    private readonly strategyScenario: StrategyScenarioService,
  ) {}

  listScenarios() {
    return this.prisma.marketScenario.findMany({
      orderBy: { name: 'asc' },
    });
  }

  recentResults(limit = 80) {
    const take = Math.min(Math.max(limit, 1), 200);
    return Promise.all([
      this.prisma.portfolioStressTest.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: { scenario: true },
      }),
      this.prisma.strategyScenarioPerformance.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: { scenario: { select: { id: true, name: true } } },
      }),
    ]).then(([portfolioStress, strategyPerf]) => ({
      portfolioStress,
      strategyPerf,
    }));
  }

  /** استرس روی سبد نمونه یا آخرین توصیهٔ کاربر */
  async portfolioStressSummary(userId?: string) {
    let carIds: string[] = [];
    let weights: number[] = [];

    if (userId) {
      const last = await this.prisma.userPortfolioRecommendation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (last?.result && typeof last.result === 'object') {
        const r = last.result as {
          cars?: Array<{ carId?: string; weight?: number }>;
        };
        const cs = r.cars ?? [];
        carIds = cs.map((c) => c.carId).filter(Boolean) as string[];
        weights = cs.map((c) => Number(c.weight ?? 0));
        const s = weights.reduce((a, b) => a + b, 0);
        if (s > 1e-6) weights = weights.map((w) => w / s);
      }
    }

    if (carIds.length < 2) {
      const top = await this.prisma.car.findMany({
        where: { scores: { investmentScore: { not: null } } },
        include: { scores: true },
        take: 40,
      });
      top.sort(
        (a, b) =>
          (b.scores?.investmentScore ?? 0) - (a.scores?.investmentScore ?? 0),
      );
      const pick = top.slice(0, 4);
      carIds = pick.map((c) => c.id);
      weights = pick.map(() => 1 / pick.length);
    }

    const battery = await this.stress.runStandardBattery(
      { carIds, weights },
      { persist: false, paths: 200 },
    );

    const stored = await this.prisma.portfolioStressTest.findMany({
      where: { scenarioId: { in: [...STANDARD_STRESS_SCENARIO_IDS] } },
      orderBy: { createdAt: 'desc' },
      take: 24,
      include: { scenario: { select: { name: true } } },
    });

    return {
      source: userId ? 'user_last_recommendation_or_fallback' : 'top_investment_fallback',
      portfolio: { carIds, weights },
      liveBattery: battery,
      recentStoredSamples: stored,
    };
  }

  async scenarioComparison(carIds: string[], weights: number[], scenarioIds?: string[]) {
    const s = weights.reduce((a, b) => a + b, 0);
    const w = Math.abs(s - 1) > 1e-4 ? weights.map((x) => x / s) : weights;
    const scenarios =
      scenarioIds?.length ?
        await this.prisma.marketScenario.findMany({
          where: { id: { in: scenarioIds } },
        })
      : await this.prisma.marketScenario.findMany({
          where: {
            id: {
              in: [
                'scen_bull_market',
                'scen_bear_market',
                'scen_market_crash',
                'scen_high_vol',
                'scen_low_liquidity',
                'scen_sideways',
              ],
            },
          },
        });

    const runs = [];
    for (const sc of scenarios) {
      const run = await this.scenarioSim.runScenario(
        { carIds, weights: w },
        sc,
        { paths: 250 },
      );
      runs.push({ scenario: { id: sc.id, name: sc.name }, run });
    }
    return { portfolio: { carIds, weights: w }, runs };
  }

  async refreshStrategyRobustness() {
    return this.strategyScenario.recomputeAllStrategyScenarioRows();
  }

  robustnessByStrategy() {
    return this.strategyScenario.robustnessSummary();
  }
}
