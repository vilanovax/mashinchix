-- CarMarketData: نوسان، ترند محبوبیت، سیگنال خرید/فروش
ALTER TABLE "CarMarketData" ADD COLUMN "volatilityScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "volatilityRaw" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "popularityTrend" TEXT;
ALTER TABLE "CarMarketData" ADD COLUMN "popularityTrendScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "buyScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "sellScore" DOUBLE PRECISION;
ALTER TABLE "CarMarketData" ADD COLUMN "marketSignal" TEXT;

-- CarScores: ترند رضایت مالک (زمانی)
ALTER TABLE "CarScores" ADD COLUMN "ownerSatisfactionTrend" TEXT;
ALTER TABLE "CarScores" ADD COLUMN "ownerSatisfactionTrendScore" DOUBLE PRECISION;

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
  cmd."adsCount" AS "adsCount",
  cmd."avgPrice" AS "avgPrice",
  cmd."minPrice" AS "minPrice",
  cmd."maxPrice" AS "maxPrice",
  cmd."liquidityScore" AS "liquidityScore",
  cmd."demandScore" AS "demandScore",
  cmd."depreciationRate30d" AS "depreciationRate30d",
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
  pp."historyPointsUsed" AS "predictionHistoryPoints"
FROM "Car" c
LEFT JOIN "CarScores" cs ON cs."carId" = c."id"
LEFT JOIN "CarMarketData" cmd ON cmd."carId" = c."id"
LEFT JOIN "OwnershipCost" oc ON oc."carId" = c."id"
LEFT JOIN "PricePrediction" pp ON pp."carId" = c."id";
