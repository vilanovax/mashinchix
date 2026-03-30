-- CarScores v2
ALTER TABLE "CarScores" ADD COLUMN "popularityScore" DOUBLE PRECISION;
ALTER TABLE "CarScores" ADD COLUMN "ownerSatisfactionScore" DOUBLE PRECISION;

-- OwnershipCost
CREATE TABLE "OwnershipCost" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "fuelMonthlyTomans" DECIMAL(18,0),
    "maintenanceYearlyTomans" DECIMAL(18,0),
    "depreciationAnnualRate" DECIMAL(8,4),
    "methodology" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnershipCost_carId_key" ON "OwnershipCost"("carId");

ALTER TABLE "OwnershipCost" ADD CONSTRAINT "OwnershipCost_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- View (خواندن با $queryRaw)
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
  oc."depreciationAnnualRate" AS "depreciationAnnualRate"
FROM "Car" c
LEFT JOIN "CarScores" cs ON cs."carId" = c."id"
LEFT JOIN "CarMarketData" cmd ON cmd."carId" = c."id"
LEFT JOIN "OwnershipCost" oc ON oc."carId" = c."id";
