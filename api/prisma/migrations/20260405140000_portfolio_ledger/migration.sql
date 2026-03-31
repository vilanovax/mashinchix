-- Portfolio ledger: real holdings, transactions, snapshots

CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "baseCurrency" TEXT DEFAULT 'IRR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioPosition" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioTransaction" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION,
    "executionResultId" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "cashValue" DOUBLE PRECISION NOT NULL,
    "investedValue" DOUBLE PRECISION NOT NULL,
    "return1d" DOUBLE PRECISION,
    "return7d" DOUBLE PRECISION,
    "return30d" DOUBLE PRECISION,
    "return90d" DOUBLE PRECISION,
    "sharpe" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "drawdown" DOUBLE PRECISION,
    "positions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Portfolio_userId_createdAt_idx" ON "Portfolio"("userId", "createdAt");

CREATE UNIQUE INDEX "PortfolioPosition_portfolioId_assetId_assetType_key" ON "PortfolioPosition"("portfolioId", "assetId", "assetType");
CREATE INDEX "PortfolioPosition_portfolioId_idx" ON "PortfolioPosition"("portfolioId");

CREATE INDEX "PortfolioTransaction_portfolioId_executedAt_idx" ON "PortfolioTransaction"("portfolioId", "executedAt");
CREATE INDEX "PortfolioTransaction_executionResultId_idx" ON "PortfolioTransaction"("executionResultId");

CREATE INDEX "PortfolioSnapshot_portfolioId_snapshotDate_idx" ON "PortfolioSnapshot"("portfolioId", "snapshotDate");

ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioPosition" ADD CONSTRAINT "PortfolioPosition_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioTransaction" ADD CONSTRAINT "PortfolioTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioTransaction" ADD CONSTRAINT "PortfolioTransaction_executionResultId_fkey" FOREIGN KEY ("executionResultId") REFERENCES "ExecutionResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
