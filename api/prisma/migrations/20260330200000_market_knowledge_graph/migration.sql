-- CreateEnum
CREATE TYPE "CarGraphRelationType" AS ENUM (
  'SIMILAR',
  'SUBSTITUTE',
  'COMPLEMENT',
  'PRICE_CORRELATED',
  'LIQUIDITY_CORRELATED',
  'RISK_CORRELATED',
  'MOMENTUM_CORRELATED',
  'SAME_SEGMENT',
  'COMPETITOR',
  'UPGRADE_PATH'
);

-- CreateEnum
CREATE TYPE "SegmentGraphRelationType" AS ENUM (
  'INDEX_CORRELATED',
  'MOMENTUM_ALIGNED',
  'SUBSTITUTION_CLUSTER',
  'FLOW_LEADER_FOLLOWER'
);

-- CreateTable
CREATE TABLE "CarRelationship" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "relatedCarId" TEXT NOT NULL,
    "relationType" "CarGraphRelationType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentRelationship" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "relatedSegment" TEXT NOT NULL,
    "relationType" "SegmentGraphRelationType" NOT NULL,
    "correlation" DOUBLE PRECISION NOT NULL,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarSimilarityScore" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "peerCarId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "specSim" DOUBLE PRECISION,
    "priceSim" DOUBLE PRECISION,
    "corrSim" DOUBLE PRECISION,
    "behaviorCooccur" DOUBLE PRECISION,
    "ownershipSim" DOUBLE PRECISION,
    "components" JSONB,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarSimilarityScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarRelationship_carId_relatedCarId_relationType_key" ON "CarRelationship"("carId", "relatedCarId", "relationType");
CREATE INDEX "CarRelationship_carId_idx" ON "CarRelationship"("carId");
CREATE INDEX "CarRelationship_relatedCarId_idx" ON "CarRelationship"("relatedCarId");
CREATE INDEX "CarRelationship_relationType_idx" ON "CarRelationship"("relationType");

CREATE UNIQUE INDEX "SegmentRelationship_segment_relatedSegment_relationType_key" ON "SegmentRelationship"("segment", "relatedSegment", "relationType");
CREATE INDEX "SegmentRelationship_segment_idx" ON "SegmentRelationship"("segment");
CREATE INDEX "SegmentRelationship_relatedSegment_idx" ON "SegmentRelationship"("relatedSegment");

CREATE UNIQUE INDEX "CarSimilarityScore_carId_peerCarId_key" ON "CarSimilarityScore"("carId", "peerCarId");
CREATE INDEX "CarSimilarityScore_carId_idx" ON "CarSimilarityScore"("carId");
CREATE INDEX "CarSimilarityScore_peerCarId_idx" ON "CarSimilarityScore"("peerCarId");

ALTER TABLE "CarRelationship" ADD CONSTRAINT "CarRelationship_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarRelationship" ADD CONSTRAINT "CarRelationship_relatedCarId_fkey" FOREIGN KEY ("relatedCarId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarSimilarityScore" ADD CONSTRAINT "CarSimilarityScore_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarSimilarityScore" ADD CONSTRAINT "CarSimilarityScore_peerCarId_fkey" FOREIGN KEY ("peerCarId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
