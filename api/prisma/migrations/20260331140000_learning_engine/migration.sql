-- CreateEnum
CREATE TYPE "LearningHorizon" AS ENUM ('D7', 'D30', 'D90');

-- CreateEnum
CREATE TYPE "LearningModelFamily" AS ENUM (
  'PREDICTION',
  'INVESTMENT_SCORE',
  'RISK_SCORE',
  'RECOMMENDATION',
  'PORTFOLIO',
  'STRATEGY',
  'DECISION',
  'SIGNAL',
  'TRIGGER',
  'GRAPH',
  'OPTIMIZATION'
);

-- CreateTable
CREATE TABLE "ModelPerformanceHistory" (
    "id" TEXT NOT NULL,
    "modelFamily" "LearningModelFamily" NOT NULL,
    "modelKey" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPerformanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveWeights" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveWeights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalPerformance" (
    "id" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "horizon" "LearningHorizon" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "avgForwardReturn" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "rewardScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionOutcome" (
    "id" TEXT NOT NULL,
    "decisionSnapshotId" TEXT NOT NULL,
    "horizon" "LearningHorizon" NOT NULL,
    "benchmarkReturnPct" DOUBLE PRECISION,
    "decisionReturnProxyPct" DOUBLE PRECISION,
    "success" BOOLEAN,
    "rewardScore" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "DecisionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationOutcome" (
    "id" TEXT NOT NULL,
    "recommendationResultId" TEXT NOT NULL,
    "modelVersion" TEXT,
    "horizon" "LearningHorizon" NOT NULL,
    "priceAtRecommendation" DECIMAL(18,0),
    "priceAfter" DECIMAL(18,0),
    "returnPct" DOUBLE PRECISION,
    "rewardScore" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "RecommendationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "referenceKind" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "horizon" "LearningHorizon" NOT NULL,
    "returnPct" DOUBLE PRECISION,
    "benchmarkReturnPct" DOUBLE PRECISION,
    "rewardScore" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PortfolioOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyOutcome" (
    "id" TEXT NOT NULL,
    "strategyName" "BacktestStrategyName" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalReturn" DOUBLE PRECISION,
    "annualReturn" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "vsMedianPeer" DOUBLE PRECISION,
    "rankAmongPeers" INTEGER,
    "rewardScore" DOUBLE PRECISION,
    "sampleTrades" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelPerformanceHistory_modelFamily_modelKey_createdAt_idx" ON "ModelPerformanceHistory"("modelFamily", "modelKey", "createdAt");

-- CreateIndex
CREATE INDEX "ModelPerformanceHistory_periodEnd_idx" ON "ModelPerformanceHistory"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveWeights_scope_key" ON "AdaptiveWeights"("scope");

-- CreateIndex
CREATE INDEX "SignalPerformance_signalKey_periodEnd_idx" ON "SignalPerformance"("signalKey", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SignalPerformance_signalKey_horizon_periodStart_periodEnd_key" ON "SignalPerformance"("signalKey", "horizon", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "DecisionOutcome_evaluatedAt_idx" ON "DecisionOutcome"("evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionOutcome_decisionSnapshotId_horizon_key" ON "DecisionOutcome"("decisionSnapshotId", "horizon");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_modelVersion_horizon_idx" ON "RecommendationOutcome"("modelVersion", "horizon");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_evaluatedAt_idx" ON "RecommendationOutcome"("evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationOutcome_recommendationResultId_horizon_key" ON "RecommendationOutcome"("recommendationResultId", "horizon");

-- CreateIndex
CREATE INDEX "PortfolioOutcome_userId_evaluatedAt_idx" ON "PortfolioOutcome"("userId", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioOutcome_referenceKind_referenceId_horizon_key" ON "PortfolioOutcome"("referenceKind", "referenceId", "horizon");

-- CreateIndex
CREATE INDEX "StrategyOutcome_periodEnd_idx" ON "StrategyOutcome"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyOutcome_strategyName_periodEnd_key" ON "StrategyOutcome"("strategyName", "periodEnd");

-- AddForeignKey
ALTER TABLE "DecisionOutcome" ADD CONSTRAINT "DecisionOutcome_decisionSnapshotId_fkey" FOREIGN KEY ("decisionSnapshotId") REFERENCES "DecisionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_recommendationResultId_fkey" FOREIGN KEY ("recommendationResultId") REFERENCES "RecommendationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
