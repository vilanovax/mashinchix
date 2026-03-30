-- Backtesting and portfolio simulation

CREATE TYPE "BacktestStrategyName" AS ENUM (
  'BUY_ON_BUY_SIGNAL',
  'BUY_TOP_INVESTMENT_SCORE',
  'BUY_LOW_RISK',
  'BUY_HIGH_MOMENTUM',
  'BUY_UNDERVALUE',
  'SEGMENT_ROTATION',
  'MARKET_CYCLE_STRATEGY',
  'RECOMMENDATION_TOP1',
  'RECOMMENDATION_TOP3',
  'HOLD_LONG_TERM',
  'SELL_ON_SELL_SIGNAL',
  'RECOMMENDATION_HISTORICAL_EVAL'
);

CREATE TABLE "BacktestResult" (
    "id" TEXT NOT NULL,
    "strategyName" "BacktestStrategyName" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalReturn" DOUBLE PRECISION NOT NULL,
    "annualReturn" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "tradesCount" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BacktestResult_strategyName_createdAt_idx" ON "BacktestResult"("strategyName", "createdAt");
CREATE INDEX "BacktestResult_startDate_endDate_idx" ON "BacktestResult"("startDate", "endDate");

CREATE TABLE "PortfolioSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "strategy" "BacktestStrategyName" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "initialCapital" DECIMAL(18,2) NOT NULL,
    "finalCapital" DECIMAL(18,2) NOT NULL,
    "totalReturn" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSimulation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortfolioSimulation_userId_createdAt_idx" ON "PortfolioSimulation"("userId", "createdAt");
CREATE INDEX "PortfolioSimulation_strategy_idx" ON "PortfolioSimulation"("strategy");

ALTER TABLE "PortfolioSimulation" ADD CONSTRAINT "PortfolioSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
