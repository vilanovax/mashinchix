/** آینهٔ سبک `TodayActionPlanResponse` در api/src/advisor/advisor.types.ts */
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
  recommendedActions: {
    type: string;
    title: string;
    description: string;
    priority: number;
    priorityScore: number;
    confidence: number;
    expectedImpact: Record<string, number | string | null>;
    metadata: Record<string, unknown>;
  }[];
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
