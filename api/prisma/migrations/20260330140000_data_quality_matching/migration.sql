-- CarAlias
CREATE TABLE "CarAlias" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "sourceFilter" "ListingSource",
    "weight" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarAlias_normalized_key" ON "CarAlias"("normalized");
CREATE INDEX "CarAlias_carId_idx" ON "CarAlias"("carId");
CREATE INDEX "CarAlias_isActive_idx" ON "CarAlias"("isActive");

ALTER TABLE "CarAlias" ADD CONSTRAINT "CarAlias_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CarListing quality
ALTER TABLE "CarListing" ADD COLUMN "isExcluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CarListing" ADD COLUMN "exclusionReason" TEXT;

-- CarReviewsRaw ingestion fields
ALTER TABLE "CarReviewsRaw" ADD COLUMN "externalId" TEXT;
ALTER TABLE "CarReviewsRaw" ADD COLUMN "title" TEXT;
ALTER TABLE "CarReviewsRaw" ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'fa';
ALTER TABLE "CarReviewsRaw" ADD COLUMN "rawMetadata" JSONB;
ALTER TABLE "CarReviewsRaw" ADD COLUMN "contentHash" TEXT;

CREATE UNIQUE INDEX "CarReviewsRaw_carId_contentHash_key" ON "CarReviewsRaw"("carId", "contentHash");
CREATE INDEX "CarReviewsRaw_carId_source_idx" ON "CarReviewsRaw"("carId", "source");
CREATE INDEX "CarReviewsRaw_source_externalId_idx" ON "CarReviewsRaw"("source", "externalId");
