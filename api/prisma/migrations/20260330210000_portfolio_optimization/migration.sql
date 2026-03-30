-- CreateTable
CREATE TABLE "PortfolioOptimizationResult" (
    "id" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "carIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weights" JSONB NOT NULL,
    "expectedReturn" DOUBLE PRECISION NOT NULL,
    "expectedVolatility" DOUBLE PRECISION NOT NULL,
    "sharpeRatio" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "diversificationScore" DOUBLE PRECISION NOT NULL,
    "riskContribution" JSONB NOT NULL,
    "constraints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioOptimizationResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortfolioOptimizationResult_methodology_createdAt_idx" ON "PortfolioOptimizationResult"("methodology", "createdAt");
