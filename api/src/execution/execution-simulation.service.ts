import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StressTestService } from '../scenario/stress-test.service';
import { simulateBuyAndHoldWeighted } from '../portfolio/custom-portfolio-sim.util';
import { diversificationScore } from '../portfolio/opt/portfolio-opt-math.util';
import type { ExecutionAction } from './execution.types';
import {
  applyExecutionActionsToPortfolio,
  totalAllocationChange,
  type WeightRow,
} from './execution-portfolio-apply.util';
import { subCalendarDays, startOfUtcDay } from '../model-evaluation/eval-price.util';

const STRESS_SCENARIO = 'scen_market_crash';

@Injectable()
export class ExecutionSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stress: StressTestService,
  ) {}

  private parseActions(raw: unknown): ExecutionAction[] {
    if (!Array.isArray(raw)) return [];
    return raw as ExecutionAction[];
  }

  private async portfolioBeforeForPlan(
    userId: string | null | undefined,
  ): Promise<WeightRow[]> {
    if (userId) {
      const last = await this.prisma.userPortfolioRecommendation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (last?.result && typeof last.result === 'object') {
        const r = last.result as { cars?: Array<{ carId: string; weight?: number }> };
        const cs = r.cars ?? [];
        if (cs.length) {
          return cs
            .filter((c) => c.carId)
            .map((c) => ({
              carId: c.carId,
              weight: Number(c.weight ?? 0),
            }));
        }
      }
    }
    const top = await this.prisma.car.findMany({
      where: { scores: { investmentScore: { not: null } } },
      include: { scores: true },
      take: 5,
      orderBy: { scores: { investmentScore: 'desc' } },
    });
    const w = 1 / Math.max(1, top.length);
    return top.map((c) => ({ carId: c.id, weight: w }));
  }

  async simulateForPlanId(planId: string) {
    const plan = await this.prisma.executionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('ExecutionPlan یافت نشد');

    const actions = this.parseActions(plan.actions);
    if (!actions.length) {
      throw new BadRequestException('پلان بدون اکشن قابل شبیه‌سازی نیست');
    }

    const beforeRows = await this.portfolioBeforeForPlan(plan.userId);
    if (!beforeRows.length) {
      throw new BadRequestException('بدون سبد پایه قابل شبیه‌سازی نیست');
    }

    const afterRows = applyExecutionActionsToPortfolio(beforeRows, actions);
    if (!afterRows.length) {
      throw new BadRequestException('خروج شبیه‌سازی سبد خالی شد');
    }

    const allocChange = totalAllocationChange(
      beforeRows,
      afterRows,
    );

    const carIds = afterRows.map((r) => r.carId);
    const weights = afterRows.map((r) => r.weight);
    const end = startOfUtcDay(new Date());
    const start = subCalendarDays(end, 240);

    const sim = await simulateBuyAndHoldWeighted(
      this.prisma,
      carIds,
      weights,
      start,
      end,
    );
    if (!sim) {
      throw new BadRequestException(
        'شبیه‌سازی تاریخی برای سبد بعد از اکشن ممکن نشد',
      );
    }

    let stressDd: number | null = null;
    try {
      const st = await this.stress.runStressTest(
        { carIds, weights },
        STRESS_SCENARIO,
        { persist: false, paths: 120 },
      );
      stressDd = st.run.maxDrawdown.mean;
    } catch {
      stressDd = null;
    }

    const divScore = diversificationScore(weights);

    const row = await this.prisma.executionSimulation.create({
      data: {
        planId,
        expectedReturn: sim.annualReturn,
        expectedRisk: sim.annualVolatility,
        expectedSharpe: sim.sharpeLike,
        expectedDrawdown: sim.maxDrawdown,
        diversificationScore: divScore,
        stressDrawdown: stressDd,
        portfolioBefore: beforeRows as unknown as Prisma.InputJsonValue,
        portfolioAfter: afterRows as unknown as Prisma.InputJsonValue,
        stressScenarioId: stressDd != null ? STRESS_SCENARIO : null,
      },
    });

    return {
      simulation: row,
      metrics: {
        allocationChange: allocChange,
        historicalSim: sim,
        stressDrawdown: stressDd,
      },
    };
  }

  async latestForPlan(planId: string) {
    return this.prisma.executionSimulation.findFirst({
      where: { planId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
