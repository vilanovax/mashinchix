-- هوشمندی پویا: مومنتوم، ترند نقدشوندگی/نوسان، آمار فروش، چرخهٔ بازار، overall v3

CREATE TYPE "MarketCycleType" AS ENUM ('BULL', 'BEAR', 'STABLE');

ALTER TABLE "CarListing" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "CarMarketData" ADD COLUMN "priceChange7d" DECIMAL(8,4);
ALTER TABLE "CarMarketData" ADD COLUMN "priceChange90d" DECIMAL(8,4);
ALTER TABLE "CarMarketData" ADD COLUMN "momentumScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "listingsLast7d" INTEGER;
ALTER TABLE "CarMarketData" ADD COLUMN "listingsPrev7d" INTEGER;
ALTER TABLE "CarMarketData" ADD COLUMN "listingsLast30d" INTEGER;
ALTER TABLE "CarMarketData" ADD COLUMN "listingsPrev30d" INTEGER;
ALTER TABLE "CarMarketData" ADD COLUMN "liquidityTrendScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "liquidityTrendLabel" TEXT;
ALTER TABLE "CarMarketData" ADD COLUMN "volatilityTrendScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "volatilityTrendLabel" TEXT;

ALTER TABLE "CarScores" ADD COLUMN "modelVersion" TEXT;

CREATE TABLE "CarLiquidityStats" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "avgDaysToSell" DOUBLE PRECISION,
    "medianDaysToSell" DOUBLE PRECISION,
    "sellThroughRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarLiquidityStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarLiquidityStats_carId_snapshotDate_key" ON "CarLiquidityStats"("carId", "snapshotDate");
CREATE INDEX "CarLiquidityStats_carId_snapshotDate_idx" ON "CarLiquidityStats"("carId", "snapshotDate");

ALTER TABLE "CarLiquidityStats" ADD CONSTRAINT "CarLiquidityStats_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketCycle" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "cycleType" "MarketCycleType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketCycle_segment_snapshotDate_key" ON "MarketCycle"("segment", "snapshotDate");
CREATE INDEX "MarketCycle_segment_snapshotDate_idx" ON "MarketCycle"("segment", "snapshotDate");

DROP VIEW IF EXISTS car_intelligence_view;
CREATE VIEW car_intelligence_view AS
SELECT
  c."id" AS car_id,
  c."brand",
  c."model",
  c."year",
  c."segment",
  cs."performanceScore",
  cs."comfortScore",
  cs."economyScore",
  cs."reliabilityScore",
  cs."marketScore",
  cs."ownershipScore",
  cs."prestigeScore",
  cs."riskScore",
  cs."overallScore",
  cs."popularityScore",
  cs."ownerSatisfactionScore",
  cs."ownerSatisfactionTrend",
  cs."ownerSatisfactionTrendScore",
  cs."investmentScore",
  cs."modelVersion" AS scores_model_version,
  cmd."adsCount" AS "adsCount",
  cmd."avgPrice" AS "avgPrice",
  cmd."minPrice" AS "minPrice",
  cmd."maxPrice" AS "maxPrice",
  cmd."liquidityScore" AS "liquidityScore",
  cmd."demandScore" AS "demandScore",
  cmd."depreciationRate30d" AS "depreciationRate30d",
  cmd."priceChange30d" AS "priceChange30d",
  cmd."priceChange7d" AS "priceChange7d",
  cmd."priceChange90d" AS "priceChange90d",
  cmd."momentumScore" AS "momentumScore",
  cmd."listingsLast7d" AS "listingsLast7d",
  cmd."listingsPrev7d" AS "listingsPrev7d",
  cmd."listingsLast30d" AS "listingsLast30d",
  cmd."listingsPrev30d" AS "listingsPrev30d",
  cmd."liquidityTrendScore" AS "liquidityTrendScore",
  cmd."liquidityTrendLabel" AS "liquidityTrendLabel",
  cmd."volatilityTrendScore" AS "volatilityTrendScore",
  cmd."volatilityTrendLabel" AS "volatilityTrendLabel",
  cmd."priceTrendLabel" AS "priceTrendLabel",
  cmd."priceTrendScore" AS "priceTrendScore",
  cmd."volatilityScore" AS "volatilityScore",
  cmd."volatilityRaw" AS "volatilityRaw",
  cmd."popularityTrend" AS "popularityTrend",
  cmd."popularityTrendScore" AS "popularityTrendScore",
  cmd."buyScore" AS "buyScore",
  cmd."sellScore" AS "sellScore",
  cmd."marketSignal" AS "marketSignal",
  (SELECT COUNT(*)::int FROM "CarReviewsRaw" r WHERE r."carId" = c."id") AS "reviewsCount",
  (SELECT COUNT(*)::int FROM "PriceHistory" ph WHERE ph."carId" = c."id") AS "priceHistoryPoints",
  (
    SELECT ph."price"
    FROM "PriceHistory" ph
    WHERE ph."carId" = c."id"
    ORDER BY ph."date" DESC
    LIMIT 1
  ) AS "lastPrice",
  oc."fuelMonthlyTomans" AS "fuelMonthlyTomans",
  oc."maintenanceYearlyTomans" AS "maintenanceYearlyTomans",
  oc."depreciationAnnualRate" AS "depreciationAnnualRate",
  pp."predictedPrice30d" AS "predictedPrice30d",
  pp."predictedPrice90d" AS "predictedPrice90d",
  pp."predictedChange30d" AS "predictedChange30d",
  pp."predictedChange90d" AS "predictedChange90d",
  pp."confidence" AS "predictionConfidence",
  pp."historyPointsUsed" AS "predictionHistoryPoints",
  (
    SELECT cls."avgDaysToSell" FROM "CarLiquidityStats" cls
    WHERE cls."carId" = c."id"
    ORDER BY cls."snapshotDate" DESC
    LIMIT 1
  ) AS liquidity_avg_days_to_sell,
  (
    SELECT cls."medianDaysToSell" FROM "CarLiquidityStats" cls
    WHERE cls."carId" = c."id"
    ORDER BY cls."snapshotDate" DESC
    LIMIT 1
  ) AS liquidity_median_days_to_sell,
  (
    SELECT cls."sellThroughRate" FROM "CarLiquidityStats" cls
    WHERE cls."carId" = c."id"
    ORDER BY cls."snapshotDate" DESC
    LIMIT 1
  ) AS liquidity_sell_through_rate,
  (
    SELECT mc."cycleType"::text FROM "MarketCycle" mc
    WHERE c."segment" IS NOT NULL AND c."segment" <> '' AND mc."segment" = c."segment"
    ORDER BY mc."snapshotDate" DESC
    LIMIT 1
  ) AS market_cycle_type,
  (
    SELECT mc."confidenceScore" FROM "MarketCycle" mc
    WHERE c."segment" IS NOT NULL AND c."segment" <> '' AND mc."segment" = c."segment"
    ORDER BY mc."snapshotDate" DESC
    LIMIT 1
  ) AS market_cycle_confidence
FROM "Car" c
LEFT JOIN "CarScores" cs ON cs."carId" = c."id"
LEFT JOIN "CarMarketData" cmd ON cmd."carId" = c."id"
LEFT JOIN "OwnershipCost" oc ON oc."carId" = c."id"
LEFT JOIN "PricePrediction" pp ON pp."carId" = c."id";
