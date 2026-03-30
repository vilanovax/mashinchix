-- CreateEnum
CREATE TYPE "DecisionMarketAction" AS ENUM ('BUY', 'SELL', 'HOLD', 'WAIT', 'CAUTIOUS');

-- CreateEnum
CREATE TYPE "DecisionPortfolioAction" AS ENUM ('REBALANCE', 'HOLD', 'REDUCE_RISK', 'INCREASE_RISK');

-- CreateEnum
CREATE TYPE "DecisionStrategyAction" AS ENUM ('MOMENTUM', 'LOW_RISK', 'BALANCED', 'CASH', 'SEGMENT_ROTATION');

-- CreateEnum
CREATE TYPE "DecisionMarketOutlook" AS ENUM ('BULL', 'BEAR', 'SIDEWAYS');

-- CreateTable
CREATE TABLE "DecisionSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "userId" TEXT,
    "marketDecision" "DecisionMarketAction" NOT NULL,
    "portfolioDecision" "DecisionPortfolioAction" NOT NULL,
    "strategyDecision" "DecisionStrategyAction" NOT NULL,
    "marketCycle" TEXT,
    "marketOutlook" "DecisionMarketOutlook" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "keyFactors" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionSnapshot_snapshotKey_key" ON "DecisionSnapshot"("snapshotKey");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_snapshotDate_idx" ON "DecisionSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_userId_snapshotDate_idx" ON "DecisionSnapshot"("userId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "DecisionSnapshot" ADD CONSTRAINT "DecisionSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
