-- Market Insights Engine: persisted insights + alerts

CREATE TYPE "InsightType" AS ENUM (
  'FASTEST_RISING_PRICE',
  'FASTEST_FALLING_PRICE',
  'HIGH_MOMENTUM',
  'HIGH_VOLATILITY',
  'LOW_VOLATILITY',
  'UNDERVALUED',
  'OVERVALUED',
  'HIGH_DEMAND_LOW_SUPPLY',
  'HIGH_SUPPLY_LOW_DEMAND',
  'FASTEST_SELLING',
  'SLOWEST_SELLING',
  'ENTERING_BULL_TREND',
  'ENTERING_BEAR_TREND',
  'BEST_INVESTMENT_OPPORTUNITY',
  'HIGH_RISK_ALERT',
  'MARKET_TURNING_POINT',
  'SEGMENT_ROTATION',
  'LIQUIDITY_SPIKE',
  'DEMAND_SPIKE'
);

CREATE TYPE "MarketAlertType" AS ENUM (
  'PRICE_DROP',
  'VOLATILITY_SPIKE',
  'MARKET_ENTERING_BEAR',
  'MARKET_ENTERING_BULL',
  'CAR_ILLIQUID',
  'BEST_INVESTMENT_SIGNAL',
  'SEGMENT_OVERHEATING',
  'SEGMENT_CRASH_RISK'
);

CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "MarketInsight" (
    "id" TEXT NOT NULL,
    "insightType" "InsightType" NOT NULL,
    "carId" TEXT,
    "segment" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "snapshotDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketAlert" (
    "id" TEXT NOT NULL,
    "alertType" "MarketAlertType" NOT NULL,
    "carId" TEXT,
    "segment" TEXT,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketInsight_insightType_snapshotDate_idx" ON "MarketInsight"("insightType", "snapshotDate");
CREATE INDEX "MarketInsight_carId_snapshotDate_idx" ON "MarketInsight"("carId", "snapshotDate");
CREATE INDEX "MarketInsight_segment_snapshotDate_idx" ON "MarketInsight"("segment", "snapshotDate");
CREATE INDEX "MarketInsight_snapshotDate_idx" ON "MarketInsight"("snapshotDate");

CREATE INDEX "MarketAlert_alertType_isActive_idx" ON "MarketAlert"("alertType", "isActive");
CREATE INDEX "MarketAlert_carId_isActive_idx" ON "MarketAlert"("carId", "isActive");
CREATE INDEX "MarketAlert_segment_isActive_idx" ON "MarketAlert"("segment", "isActive");
CREATE INDEX "MarketAlert_createdAt_idx" ON "MarketAlert"("createdAt");

ALTER TABLE "MarketInsight" ADD CONSTRAINT "MarketInsight_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketAlert" ADD CONSTRAINT "MarketAlert_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
