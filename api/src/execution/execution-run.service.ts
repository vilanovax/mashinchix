import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionSimulationService } from './execution-simulation.service';
import { ExecutionPolicyService } from './execution-policy.service';
import { LearningOutcomeService } from '../learning/learning-outcome.service';
import type { ExecutionAction } from './execution.types';
import { totalAllocationChange, type WeightRow } from './execution-portfolio-apply.util';
import { PortfolioLedgerService } from '../portfolio/portfolio-ledger.service';

@Injectable()
export class ExecutionRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulation: ExecutionSimulationService,
    private readonly policy: ExecutionPolicyService,
    private readonly learningOutcomes: LearningOutcomeService,
    private readonly portfolioLedger: PortfolioLedgerService,
  ) {}

  async simulatePlan(planId: string) {
    return this.simulation.simulateForPlanId(planId);
  }

  async approvePlan(
    planId: string,
    userId: string,
    approved: boolean,
    note?: string,
  ) {
    const plan = await this.prisma.executionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('پلان یافت نشد');
    return this.prisma.executionApproval.create({
      data: {
        planId,
        userId,
        approved,
        approvedAt: approved ? new Date() : null,
        note: note ?? null,
      },
    });
  }

  async executePlan(
    planId: string,
    opts?: { userId?: string; bypassApproval?: boolean },
  ) {
    const plan = await this.prisma.executionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('پلان یافت نشد');

    let simRow = await this.simulation.latestForPlan(planId);
    if (!simRow) {
      const run = await this.simulation.simulateForPlanId(planId);
      simRow = run.simulation;
    }

    const actions = Array.isArray(plan.actions)
      ? (plan.actions as ExecutionAction[])
      : [];
    if (!actions.length) {
      throw new BadRequestException('پلان بدون اکشن');
    }

    const before = simRow.portfolioBefore as unknown as WeightRow[];
    const after = simRow.portfolioAfter as unknown as WeightRow[];
    const allocationChange = totalAllocationChange(
      Array.isArray(before) ? before : [],
      Array.isArray(after) ? after : [],
    );

    const uid = opts?.userId ?? plan.userId;

    const pol = await this.policy.evaluateAggregate({
      actions,
      allocationChange,
      simulationRisk: simRow.expectedRisk,
      simulationDrawdown: simRow.expectedDrawdown,
      stressDrawdown: simRow.stressDrawdown,
      userId: uid,
    });

    if (!pol.allowed) {
      return {
        ok: false,
        reason: 'policy_hard_block',
        policy: pol,
        simulationId: simRow.id,
      };
    }

    if (pol.requiresApproval && uid && !opts?.bypassApproval) {
      const last = await this.prisma.executionApproval.findFirst({
        where: { planId, userId: uid, approved: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!last) {
        return {
          ok: false,
          needsApproval: true,
          policy: pol,
          simulationId: simRow.id,
        };
      }
    }

    let top = [...actions]
      .sort((a, b) => b.priority - a.priority)
      .filter(
        (a) =>
          a.actionType !== 'WATCHLIST_ADD' &&
          a.actionType !== 'WATCHLIST_REMOVE',
      )
      .slice(0, 4);
    if (!top.length) {
      top = [...actions].sort((a, b) => b.priority - a.priority).slice(0, 2);
    }

    const slip = 0.004;
    const n = Math.max(1, top.length);
    const expRet = simRow.expectedReturn / n;
    const createdIds: string[] = [];

    for (const a of top) {
      const row = await this.prisma.executionResult.create({
        data: {
          planId,
          userId: plan.userId,
          actionType: a.actionType,
          status: 'EXECUTED',
          expectedReturn: expRet,
          realizedReturn: expRet * (1 - slip),
          expectedRisk: simRow.expectedRisk,
          realizedRisk: simRow.expectedRisk * (1 + slip * 0.5),
          expectedSharpe: simRow.expectedSharpe,
          realizedSharpe: simRow.expectedSharpe * (1 - slip),
          slippage: slip,
          transactionCost: 0.001,
          portfolioBefore:
            simRow.portfolioBefore == null
              ? undefined
              : (simRow.portfolioBefore as Prisma.InputJsonValue),
          portfolioAfter:
            simRow.portfolioAfter == null
              ? undefined
              : (simRow.portfolioAfter as Prisma.InputJsonValue),
          metadata: {
            confidence: a.confidence,
            priority: a.priority,
            policy: pol,
            marketOutlook: null,
            strategyKey: null,
          } as Prisma.InputJsonValue,
        },
      });
      createdIds.push(row.id);
    }

    for (const rid of createdIds) {
      await this.portfolioLedger.applyExecutionResult(rid);
    }

    const learn = await this.learningOutcomes.ingestExecutionResults(planId);

    return {
      ok: true,
      policy: pol,
      simulationId: simRow.id,
      resultIds: createdIds,
      learning: learn,
    };
  }
}
