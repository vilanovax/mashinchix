-- AlterEnum
ALTER TYPE "LearningModelFamily" ADD VALUE 'EXECUTION';

-- CreateTable
CREATE TABLE "ExecutionSimulation" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "expectedReturn" DOUBLE PRECISION NOT NULL,
    "expectedRisk" DOUBLE PRECISION NOT NULL,
    "expectedSharpe" DOUBLE PRECISION NOT NULL,
    "expectedDrawdown" DOUBLE PRECISION NOT NULL,
    "diversificationScore" DOUBLE PRECISION,
    "stressDrawdown" DOUBLE PRECISION,
    "portfolioBefore" JSONB,
    "portfolioAfter" JSONB NOT NULL,
    "stressScenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionPolicy" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxAllocationChange" DOUBLE PRECISION,
    "maxTradeAmount" DOUBLE PRECISION,
    "maxPortfolioRisk" DOUBLE PRECISION,
    "maxDrawdownAllowed" DOUBLE PRECISION,
    "minConfidenceAuto" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionApproval" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionResult" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expectedReturn" DOUBLE PRECISION,
    "realizedReturn" DOUBLE PRECISION,
    "expectedRisk" DOUBLE PRECISION,
    "realizedRisk" DOUBLE PRECISION,
    "expectedSharpe" DOUBLE PRECISION,
    "realizedSharpe" DOUBLE PRECISION,
    "slippage" DOUBLE PRECISION,
    "transactionCost" DOUBLE PRECISION,
    "portfolioBefore" JSONB,
    "portfolioAfter" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ExecutionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionOutcome" (
    "id" TEXT NOT NULL,
    "executionResultId" TEXT NOT NULL,
    "horizon" "LearningHorizon" NOT NULL DEFAULT 'D30',
    "expectedReturn" DOUBLE PRECISION,
    "realizedReturn" DOUBLE PRECISION,
    "success" BOOLEAN,
    "rewardScore" DOUBLE PRECISION,
    "riskPenalty" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ExecutionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionPolicy_actionType_key" ON "ExecutionPolicy"("actionType");

-- CreateIndex
CREATE INDEX "ExecutionPolicy_actionType_idx" ON "ExecutionPolicy"("actionType");

-- CreateIndex
CREATE INDEX "ExecutionSimulation_planId_createdAt_idx" ON "ExecutionSimulation"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionApproval_planId_userId_idx" ON "ExecutionApproval"("planId", "userId");

-- CreateIndex
CREATE INDEX "ExecutionApproval_userId_createdAt_idx" ON "ExecutionApproval"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionResult_planId_executedAt_idx" ON "ExecutionResult"("planId", "executedAt");

-- CreateIndex
CREATE INDEX "ExecutionResult_userId_executedAt_idx" ON "ExecutionResult"("userId", "executedAt");

-- CreateIndex
CREATE INDEX "ExecutionResult_actionType_status_idx" ON "ExecutionResult"("actionType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionOutcome_executionResultId_key" ON "ExecutionOutcome"("executionResultId");

-- CreateIndex
CREATE INDEX "ExecutionOutcome_evaluatedAt_idx" ON "ExecutionOutcome"("evaluatedAt");

-- AddForeignKey
ALTER TABLE "ExecutionSimulation" ADD CONSTRAINT "ExecutionSimulation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionApproval" ADD CONSTRAINT "ExecutionApproval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionApproval" ADD CONSTRAINT "ExecutionApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionResult" ADD CONSTRAINT "ExecutionResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionResult" ADD CONSTRAINT "ExecutionResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionOutcome" ADD CONSTRAINT "ExecutionOutcome_executionResultId_fkey" FOREIGN KEY ("executionResultId") REFERENCES "ExecutionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
