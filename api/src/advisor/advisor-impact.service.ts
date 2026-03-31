import { Injectable } from '@nestjs/common';
import type { ExecutionPlanResult } from '../execution/execution.types';
import type { TodayExpectedImpact } from './advisor.types';

@Injectable()
export class AdvisorImpactService {
  aggregateFromPlanAndUnified(
    plan: ExecutionPlanResult,
    unified: {
      bestPortfolio?: { diversificationScore?: number | null } | null;
      portfolio?: { cars?: Array<{ weight?: number }> } | null;
    },
  ): TodayExpectedImpact {
    const sim = plan.simulation ?? {};
    const er = sim.expectedReturnDelta ?? null;
    const rr = sim.riskReduction ?? null;
    const sh = sim.sharpeImprovement ?? null;
    const dd = sim.drawdownReduction ?? null;

    let diversificationChange: number | null = null;
    const bpDiv = unified.bestPortfolio?.diversificationScore;
    if (bpDiv != null && Number.isFinite(bpDiv)) {
      diversificationChange = Math.min(
        0.3,
        Math.max(-0.3, (Number(bpDiv) - 0.5) * 0.35),
      );
    }

    let liquidityChange: number | null = null;
    if (plan.actions.some((a) => a.actionType === 'MOVE_TO_CASH')) {
      liquidityChange = 0.06;
    }

    const cars = unified.portfolio?.cars;
    if (cars?.length) {
      const h = cars.reduce(
        (s, c) => s + (c.weight ?? 0) * (c.weight ?? 0),
        0,
      );
      if (h > 0.42 && diversificationChange == null) {
        diversificationChange = Math.min(0.22, (h - 0.35) * 0.4);
      }
    }

    return {
      returnChange: er,
      riskChange: rr != null ? -rr : null,
      sharpeChange: sh ?? null,
      drawdownChange: dd != null ? -dd : null,
      diversificationChange,
      liquidityChange,
    };
  }
}
