import type { ExecutionActionType } from '../execution/execution.types';

export type AdvisorActionType =
  | 'REBALANCE_PORTFOLIO'
  | 'BUY_OPPORTUNITY'
  | 'SELL_HIGH_RISK'
  | 'REDUCE_RISK'
  | 'ROTATE_SEGMENT'
  | 'INCREASE_CASH'
  | 'SWITCH_STRATEGY'
  | 'HOLD'
  | 'WAIT'
  | 'DIVERSIFY_PORTFOLIO';

export type AdvisorAction = {
  type: AdvisorActionType;
  title: string;
  description: string;
  priority: number;
  priorityScore: number;
  confidence: number;
  expectedImpact: Record<string, number | string | null>;
  metadata: Record<string, unknown>;
};

export type TodayExpectedImpact = {
  returnChange: number | null;
  riskChange: number | null;
  sharpeChange: number | null;
  drawdownChange: number | null;
  diversificationChange: number | null;
  liquidityChange: number | null;
};

export type TodayActionPlanResponse = {
  date: string;
  marketState: string | null;
  portfolioState: string | null;
  riskState: string | null;
  recommendedActions: AdvisorAction[];
  expectedImpact: TodayExpectedImpact;
  warnings: string[];
  opportunities: unknown[];
  confidence: number | null;
  summary: string | null;
  briefing: string | null;
  summaryEnglish: string | null;
  persistedAdvisorSnapshotId: string | null;
  sources: {
    executionPlanConfidence: number | null;
    intelligenceSnapshotDate: string | null;
    userAlertsCount: number;
    opportunitiesCount: number;
  };
};

export const EXEC_TO_ADVISOR_TYPE: Record<
  ExecutionActionType,
  AdvisorActionType
> = {
  REBALANCE_PORTFOLIO: 'REBALANCE_PORTFOLIO',
  BUY_CAR: 'BUY_OPPORTUNITY',
  SELL_CAR: 'SELL_HIGH_RISK',
  REDUCE_RISK: 'REDUCE_RISK',
  INCREASE_RISK: 'BUY_OPPORTUNITY',
  MOVE_TO_CASH: 'INCREASE_CASH',
  SWITCH_STRATEGY: 'SWITCH_STRATEGY',
  ROTATE_SEGMENT: 'ROTATE_SEGMENT',
  HOLD_POSITION: 'HOLD',
  WATCHLIST_ADD: 'WAIT',
  WATCHLIST_REMOVE: 'WAIT',
};

export const ADVISOR_TITLE_FA: Record<AdvisorActionType, string> = {
  REBALANCE_PORTFOLIO: 'ری‌بالانس سبد سرمایه',
  BUY_OPPORTUNITY: 'فرصت خرید / افزایش سهم',
  SELL_HIGH_RISK: 'کاهش / فروش موقعیت پرریسک',
  REDUCE_RISK: 'کاهش ریسک سبد',
  ROTATE_SEGMENT: 'چرخش بین سگمنت‌ها',
  INCREASE_CASH: 'افزایش نقدینگی',
  SWITCH_STRATEGY: 'تغییر استراتژی بک‌تست',
  HOLD: 'نگهداری',
  WAIT: 'صبر و رصد',
  DIVERSIFY_PORTFOLIO: 'افزایش تنوع سبد',
};
