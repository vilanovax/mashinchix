-- CreateTable
CREATE TABLE "IntelligenceSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "marketOverview" JSONB NOT NULL,
    "riskOverview" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "alerts" JSONB NOT NULL,
    "decision" JSONB NOT NULL,
    "bestCars" JSONB NOT NULL,
    "bestPortfolio" JSONB NOT NULL,
    "bestStrategy" TEXT,
    "briefing" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceSnapshot_snapshotKey_key" ON "IntelligenceSnapshot"("snapshotKey");

-- CreateIndex
CREATE INDEX "IntelligenceSnapshot_snapshotDate_idx" ON "IntelligenceSnapshot"("snapshotDate");
