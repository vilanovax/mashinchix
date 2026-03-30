-- CarScores: امتیاز سرمایه‌گذاری (v2)
ALTER TABLE "CarScores" ADD COLUMN "investmentScore" DOUBLE PRECISION;

-- پیش‌بینی قیمت از روند تاریخچه
CREATE TABLE "PricePrediction" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "predictedPrice30d" DECIMAL(18,0),
    "predictedPrice90d" DECIMAL(18,0),
    "predictedChange30d" DECIMAL(8,4),
    "predictedChange90d" DECIMAL(8,4),
    "confidence" DOUBLE PRECISION,
    "historyPointsUsed" INTEGER,
    "methodology" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricePrediction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricePrediction_carId_key" ON "PricePrediction"("carId");
ALTER TABLE "PricePrediction" ADD CONSTRAINT "PricePrediction_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- شاخص بازار به تفکیک سگمنت
CREATE TABLE "SegmentMarketIndex" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "indexValue" DOUBLE PRECISION NOT NULL,
    "avgPredictedChange30d" DOUBLE PRECISION,
    "liquidityAvg" DOUBLE PRECISION,
    "demandAvg" DOUBLE PRECISION,
    "carCount" INTEGER NOT NULL,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentMarketIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SegmentMarketIndex_segment_snapshotDate_key" ON "SegmentMarketIndex"("segment", "snapshotDate");
CREATE INDEX "SegmentMarketIndex_segment_snapshotDate_idx" ON "SegmentMarketIndex"("segment", "snapshotDate");

-- پروفایل کاربر برای موتور توصیه v2
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoreWeights" JSONB,
    "preferredSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minBudget" DECIMAL(18,0),
    "maxBudget" DECIMAL(18,0),
    "investmentBias" DOUBLE PRECISION,
    "holdHorizonMonths" INTEGER,
    "popularityWeight" DOUBLE PRECISION,
    "ownerSatisfactionWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ویوی intelligence: investment + prediction
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
  cs."investmentScore",
  cmd."adsCount" AS "adsCount",
  cmd."avgPrice" AS "avgPrice",
  cmd."minPrice" AS "minPrice",
  cmd."maxPrice" AS "maxPrice",
  cmd."liquidityScore" AS "liquidityScore",
  cmd."demandScore" AS "demandScore",
  cmd."depreciationRate30d" AS "depreciationRate30d",
  cmd."priceTrendLabel" AS "priceTrendLabel",
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
