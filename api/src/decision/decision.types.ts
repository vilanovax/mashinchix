import type {
  DecisionMarketAction,
  DecisionMarketOutlook,
  DecisionPortfolioAction,
  DecisionStrategyAction,
  RiskLevel,
} from '@prisma/client';

export type DecisionCarHint = {
  carId: string;
  brand: string;
  model: string;
  year: number;
  reason?: string;
};

export type DecisionSummaryPayload = {
  generatedAt: string;
  snapshotDate: string;
  userId?: string | null;
  marketDecision: DecisionMarketAction;
  portfolioDecision: DecisionPortfolioAction;
  strategyDecision: DecisionStrategyAction;
  segmentRecommendation: string[];
  avoidSegments: string[];
  bestCarsToBuy: DecisionCarHint[];
  carsToSell: DecisionCarHint[];
  riskLevel: RiskLevel;
  marketOutlook: DecisionMarketOutlook;
  confidenceScore: number;
  explanation: string;
  keyFactors: string[];
  warnings: string[];
  opportunities: string[];
  worstScenarioHint?: string | null;
  strategyAdvisorNote: string | null;
  marketCycleSummary: string | null;
};
