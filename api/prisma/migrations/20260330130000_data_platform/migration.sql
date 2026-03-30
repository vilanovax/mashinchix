-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('DIVAR', 'BAMA');

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN "listingCount" INTEGER;

-- AlterTable
ALTER TABLE "CarMarketData" ADD COLUMN "depreciationRate30d" DECIMAL(8,4),
ADD COLUMN "priceTrendScore" DOUBLE PRECISION,
ADD COLUMN "priceTrendLabel" TEXT,
ADD COLUMN "demandScore" DOUBLE PRECISION,
ADD COLUMN "metricsComputedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CarListing" (
    "id" TEXT NOT NULL,
    "source" "ListingSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "carId" TEXT,
    "price" DECIMAL(18,0) NOT NULL,
    "mileageKm" INTEGER,
    "yearModel" INTEGER,
    "city" TEXT,
    "title" TEXT,
    "description" TEXT,
    "listingUrl" TEXT,
    "listedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,

    CONSTRAINT "CarListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarListing_source_externalId_key" ON "CarListing"("source", "externalId");

-- CreateIndex
CREATE INDEX "CarListing_carId_idx" ON "CarListing"("carId");

-- CreateIndex
CREATE INDEX "CarListing_source_scrapedAt_idx" ON "CarListing"("source", "scrapedAt");

-- CreateIndex
CREATE INDEX "CarListing_listedAt_idx" ON "CarListing"("listedAt");

-- AddForeignKey
ALTER TABLE "CarListing" ADD CONSTRAINT "CarListing_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
