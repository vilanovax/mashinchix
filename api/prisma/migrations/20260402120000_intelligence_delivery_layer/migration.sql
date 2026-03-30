-- Intelligence delivery: watchlists, user notifications, market reports, personalized insights, API keys

CREATE TYPE "UserNotificationType" AS ENUM (
  'PRICE_DROP',
  'PRICE_RISE',
  'BUY_SIGNAL',
  'SELL_SIGNAL',
  'HIGH_RISK',
  'MARKET_ALERT',
  'INSIGHT',
  'WATCHLIST_UPDATE',
  'RECOMMENDATION',
  'MARKET_REPORT'
);

CREATE TYPE "PersonalizedInsightType" AS ENUM (
  'FAVORITE_SEGMENT_REGIME',
  'WATCHLIST_PRICE_CONTEXT',
  'SEGMENT_PEERS_MOMENTUM',
  'LOW_RISK_IN_BUDGET',
  'PROFILE_INVESTMENT_MATCH',
  'RECENT_BEHAVIOR_NUDGE'
);

CREATE TYPE "MarketReportFrequency" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "UserWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "notes" TEXT,
    "targetBuyPrice" DECIMAL(18,0),
    "targetSellPrice" DECIMAL(18,0),
    "alertOnPriceDrop" BOOLEAN NOT NULL DEFAULT true,
    "alertOnPriceRise" BOOLEAN NOT NULL DEFAULT false,
    "alertOnBuySignal" BOOLEAN NOT NULL DEFAULT true,
    "alertOnSellSignal" BOOLEAN NOT NULL DEFAULT true,
    "alertOnHighRisk" BOOLEAN NOT NULL DEFAULT true,
    "alertOnMomentum" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWatchlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWatchlist_userId_carId_key" ON "UserWatchlist"("userId", "carId");
CREATE INDEX "UserWatchlist_userId_idx" ON "UserWatchlist"("userId");
CREATE INDEX "UserWatchlist_carId_idx" ON "UserWatchlist"("carId");

CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "carId" TEXT,
    "segment" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");
CREATE INDEX "UserNotification_userId_isRead_idx" ON "UserNotification"("userId", "isRead");
CREATE INDEX "UserNotification_carId_idx" ON "UserNotification"("carId");

CREATE TABLE "MarketReport" (
    "id" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "frequency" "MarketReportFrequency" NOT NULL DEFAULT 'DAILY',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "marketCycle" JSONB NOT NULL,
    "topRisingCars" JSONB NOT NULL,
    "topFallingCars" JSONB NOT NULL,
    "bestInvestments" JSONB NOT NULL,
    "highestRiskCars" JSONB NOT NULL,
    "fastestSellingCars" JSONB NOT NULL,
    "segmentTrends" JSONB NOT NULL,
    "volatilityOverview" JSONB NOT NULL,
    "liquidityOverview" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketReport_reportDate_frequency_key" ON "MarketReport"("reportDate", "frequency");
CREATE INDEX "MarketReport_reportDate_idx" ON "MarketReport"("reportDate");

CREATE TABLE "PersonalizedInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightType" "PersonalizedInsightType" NOT NULL,
    "carId" TEXT,
    "segment" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalizedInsight_userId_createdAt_idx" ON "PersonalizedInsight"("userId", "createdAt");
CREATE INDEX "PersonalizedInsight_insightType_idx" ON "PersonalizedInsight"("insightType");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PersonalizedInsight" ADD CONSTRAINT "PersonalizedInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalizedInsight" ADD CONSTRAINT "PersonalizedInsight_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
