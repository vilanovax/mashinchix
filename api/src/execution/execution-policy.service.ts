import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ExecutionAction } from './execution.types';

const DEFAULT_POLICIES: Array<{
  actionType: string;
  autoExecute: boolean;
  requireApproval: boolean;
  maxAllocationChange: number | null;
  maxTradeAmount: number | null;
  maxPortfolioRisk: number | null;
  maxDrawdownAllowed: number | null;
  minConfidenceAuto: number | null;
}> = [
  {
    actionType: 'REBALANCE_PORTFOLIO',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: 0.14,
    maxTradeAmount: null,
    maxPortfolioRisk: 0.52,
    maxDrawdownAllowed: 0.42,
    minConfidenceAuto: null,
  },
  {
    actionType: 'BUY_CAR',
    autoExecute: false,
    requireApproval: true,
    maxAllocationChange: 0.08,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: 80,
  },
  {
    actionType: 'SELL_CAR',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: 0.12,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: 55,
  },
  {
    actionType: 'REDUCE_RISK',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: 0.2,
    maxTradeAmount: null,
    maxPortfolioRisk: 0.48,
    maxDrawdownAllowed: 0.38,
    minConfidenceAuto: 58,
  },
  {
    actionType: 'INCREASE_RISK',
    autoExecute: false,
    requireApproval: true,
    maxAllocationChange: 0.1,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: null,
  },
  {
    actionType: 'MOVE_TO_CASH',
    autoExecute: false,
    requireApproval: true,
    maxAllocationChange: 0.25,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: 0.35,
    minConfidenceAuto: null,
  },
  {
    actionType: 'SWITCH_STRATEGY',
    autoExecute: false,
    requireApproval: true,
    maxAllocationChange: null,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: null,
  },
  {
    actionType: 'ROTATE_SEGMENT',
    autoExecute: false,
    requireApproval: true,
    maxAllocationChange: 0.18,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: null,
  },
  {
    actionType: 'HOLD_POSITION',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: null,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: null,
  },
  {
    actionType: 'WATCHLIST_ADD',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: null,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: 50,
  },
  {
    actionType: 'WATCHLIST_REMOVE',
    autoExecute: true,
    requireApproval: false,
    maxAllocationChange: null,
    maxTradeAmount: null,
    maxPortfolioRisk: null,
    maxDrawdownAllowed: null,
    minConfidenceAuto: null,
  },
];

export type PolicyEvaluation = {
  allowed: boolean;
  requiresApproval: boolean;
  autoExecute: boolean;
  violations: string[];
};

@Injectable()
export class ExecutionPolicyService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultPolicies();
  }

  async ensureDefaultPolicies(): Promise<void> {
    for (const p of DEFAULT_POLICIES) {
      await this.prisma.executionPolicy.upsert({
        where: { actionType: p.actionType },
        create: {
          actionType: p.actionType,
          autoExecute: p.autoExecute,
          requireApproval: p.requireApproval,
          maxAllocationChange: p.maxAllocationChange,
          maxTradeAmount: p.maxTradeAmount,
          maxPortfolioRisk: p.maxPortfolioRisk,
          maxDrawdownAllowed: p.maxDrawdownAllowed,
          minConfidenceAuto: p.minConfidenceAuto,
        },
        update: {},
      });
    }
    this.logger.log('ExecutionPolicy defaults ensured');
  }

  async getPolicy(actionType: string) {
    return this.prisma.executionPolicy.findUnique({
      where: { actionType },
    });
  }

  /**
   * ارزیابی سیاست برای کل پلان بر اساس شبیه‌سازی و بزرگ‌ترین اکشن‌ها.
   */
  async evaluateAggregate(input: {
    actions: ExecutionAction[];
    allocationChange: number;
    simulationRisk: number;
    simulationDrawdown: number;
    stressDrawdown: number | null;
    userId?: string | null;
  }): Promise<PolicyEvaluation> {
    const violations: string[] = [];
    let requiresApproval = false;
    let autoExecute = true;

    const top = [...input.actions].sort((a, b) => b.priority - a.priority).slice(0, 5);

    for (const a of top) {
      const pol = DEFAULT_POLICIES.find((x) => x.actionType === a.actionType);
      if (!pol) continue;
      if (pol.requireApproval) requiresApproval = true;
      if (!pol.autoExecute) autoExecute = false;
      if (
        pol.minConfidenceAuto != null &&
        a.confidence < pol.minConfidenceAuto
      ) {
        requiresApproval = true;
        violations.push(
          `confidence ${a.actionType}=${a.confidence} < ${pol.minConfidenceAuto} (نیاز به تأیید)`,
        );
      }
      if (
        pol.maxAllocationChange != null &&
        input.allocationChange > pol.maxAllocationChange
      ) {
        requiresApproval = true;
        violations.push(
          `allocationChange ${input.allocationChange.toFixed(3)} > ${pol.maxAllocationChange} برای ${a.actionType}`,
        );
      }
    }

    const maxRisk = 0.55;
    if (input.simulationRisk > maxRisk) {
      violations.push('ریسک پس از اجرا بالاتر از سقف سیاست است.');
      requiresApproval = true;
    }

    const maxDdPol =
      DEFAULT_POLICIES.find((p) => p.maxDrawdownAllowed != null)
        ?.maxDrawdownAllowed ?? 0.45;
    if (input.simulationDrawdown > maxDdPol) {
      violations.push('حداکثر افت شبیه‌سازی‌شده بالاتر از سقف سیاست است.');
      requiresApproval = true;
    }
    if (
      input.stressDrawdown != null &&
      input.stressDrawdown > maxDdPol * 1.15
    ) {
      violations.push('افت استرس‌تست بالاتر از حد قابل قبول است.');
      requiresApproval = true;
    }

    const hardBlock =
      input.simulationDrawdown > 0.58 ||
      (input.stressDrawdown != null && input.stressDrawdown > 0.65);
    if (hardBlock) {
      violations.push(' بلاک سخت: افت شدید در مسیر شبیه‌سازی/استرس.');
    }

    if (input.userId) {
      const bp = await this.prisma.userBehaviorProfile.findUnique({
        where: { userId: input.userId },
      });
      if (bp?.confidenceTrust != null && bp.confidenceTrust < 0.4) {
        requiresApproval = true;
        violations.push(
          'اعتماد رفتاری به مشاور پایین است؛ پیشنهاد با تأیید دستی.',
        );
      }
      if (bp?.overrideRate != null && bp.overrideRate > 0.36) {
        requiresApproval = true;
        violations.push(
          'کاربر اغلب اقدامات را تغییر می‌دهد؛ اجرای خودکار محدود می‌شود.',
        );
      }
    }

    return {
      allowed: !hardBlock,
      requiresApproval,
      autoExecute: autoExecute && !requiresApproval && !hardBlock,
      violations,
    };
  }
}
