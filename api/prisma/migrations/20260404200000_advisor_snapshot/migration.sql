-- Advisor Layer: daily action snapshot per user
CREATE TABLE "AdvisorSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "marketState" TEXT,
    "portfolioState" TEXT,
    "riskState" TEXT,
    "actions" JSONB NOT NULL,
    "expectedImpact" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "briefing" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisorSnapshot_userId_snapshotDate_idx" ON "AdvisorSnapshot"("userId", "snapshotDate");

ALTER TABLE "AdvisorSnapshot" ADD CONSTRAINT "AdvisorSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
