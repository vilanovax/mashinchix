export type ExecutionActionType =
  | 'REBALANCE_PORTFOLIO'
  | 'BUY_CAR'
  | 'SELL_CAR'
  | 'REDUCE_RISK'
  | 'INCREASE_RISK'
  | 'MOVE_TO_CASH'
  | 'SWITCH_STRATEGY'
  | 'ROTATE_SEGMENT'
  | 'HOLD_POSITION'
  | 'WATCHLIST_ADD'
  | 'WATCHLIST_REMOVE';

export type ExecutionAction = {
  actionType: ExecutionActionType;
  priority: number;
  relatedCars?: string[];
  targetAllocation?: Record<string, number>;
  reason: string;
  confidence: number;
  expectedImpact?: string;
  riskImpact?: string;
};

export type ExecutionSimulationSummary = {
  expectedReturnDelta?: number | null;
  riskReduction?: number | null;
  drawdownReduction?: number | null;
  sharpeImprovement?: number | null;
};

export type ExecutionPlanResult = {
  planDate: string;
  userId?: string | null;
  actions: ExecutionAction[];
  summary: string;
  expectedReturn: number | null;
  expectedRisk: number | null;
  confidence: number | null;
  simulation: ExecutionSimulationSummary;
  sources: Record<string, unknown>;
  persistedId?: string | null;
};

export type RebalanceTrade = {
  carId: string;
  side: 'BUY' | 'SELL';
  deltaWeight: number;
  deltaWeightPct: number;
};

export type PortfolioRebalanceResult = {
  ok: boolean;
  userId: string;
  drift: number | null;
  trades: RebalanceTrade[];
  urgency: number;
  recommendedTiming: 'NOW' | 'THIS_WEEK' | 'WAIT';
  rebalanceMode: 'FULL' | 'PARTIAL';
  transactionCostBps: number;
  notes: string[];
  currentSnapshot?: {
    expectedReturn?: number;
    expectedVolatility?: number;
    expectedDrawdown?: number;
  };
  optimalSnapshot?: {
    expectedReturn?: number;
    expectedVolatility?: number;
    expectedDrawdown?: number;
  };
};
