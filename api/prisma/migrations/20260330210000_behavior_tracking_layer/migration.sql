CREATE TYPE "UserEventType" AS ENUM (
  'PAGE_VIEW',
  'CAR_DETAIL_VIEW',
  'RECOMMENDATION_VIEW',
  'RECOMMENDATION_CLICK',
  'RECOMMENDATION_DISMISS',
  'WISHLIST_ADD',
  'WISHLIST_REMOVE',
  'COMPARE_ADD',
  'MARKET_SIGNAL_VIEW',
  'CONTACT_SELLER_CLICK',
  'FILTER_APPLY',
  'SEARCH',
  'PROFILE_UPDATE'
);

CREATE TYPE "RecommendationSource" AS ENUM (
  'MANUAL',
  'PROFILE_BASED',
  'SCENARIO_BASED',
  'API',
  'SYSTEM'
);

CREATE TABLE "RecommendationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "source" "RecommendationSource" NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationSession_userId_createdAt_idx" ON "RecommendationSession"("userId", "createdAt");

ALTER TABLE "RecommendationSession" ADD CONSTRAINT "RecommendationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "eventType" "UserEventType" NOT NULL,
    "carId" TEXT,
    "recommendationSessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserEvent_userId_createdAt_idx" ON "UserEvent"("userId", "createdAt");
CREATE INDEX "UserEvent_carId_createdAt_idx" ON "UserEvent"("carId", "createdAt");
CREATE INDEX "UserEvent_recommendationSessionId_createdAt_idx" ON "UserEvent"("recommendationSessionId", "createdAt");

ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RecommendationResult" (
    "id" TEXT NOT NULL,
    "recommendationSessionId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "explanation" JSONB,
    "wasClicked" BOOLEAN NOT NULL DEFAULT false,
    "wasSaved" BOOLEAN NOT NULL DEFAULT false,
    "wasDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationResult_recommendationSessionId_carId_key" ON "RecommendationResult"("recommendationSessionId", "carId");
CREATE INDEX "RecommendationResult_recommendationSessionId_rank_idx" ON "RecommendationResult"("recommendationSessionId", "rank");

ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CarBehaviorMetricsDaily" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "detailViews" INTEGER NOT NULL DEFAULT 0,
    "recommendationViews" INTEGER NOT NULL DEFAULT 0,
    "recommendationClicks" INTEGER NOT NULL DEFAULT 0,
    "recommendationDismisses" INTEGER NOT NULL DEFAULT 0,
    "wishlistAdds" INTEGER NOT NULL DEFAULT 0,
    "compareAdds" INTEGER NOT NULL DEFAULT 0,
    "marketSignalViews" INTEGER NOT NULL DEFAULT 0,
    "sellerClicks" INTEGER NOT NULL DEFAULT 0,
    "ctrRecommendation" DOUBLE PRECISION,
    "saveRate" DOUBLE PRECISION,
    "dismissRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarBehaviorMetricsDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarBehaviorMetricsDaily_carId_snapshotDate_key" ON "CarBehaviorMetricsDaily"("carId", "snapshotDate");

ALTER TABLE "CarBehaviorMetricsDaily" ADD CONSTRAINT "CarBehaviorMetricsDaily_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserPreferenceSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalDate" DATE NOT NULL,
    "preferredSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inferredWeights" JSONB,
    "favoriteCarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" DOUBLE PRECISION,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreferenceSignal_userId_signalDate_key" ON "UserPreferenceSignal"("userId", "signalDate");
CREATE INDEX "UserPreferenceSignal_userId_signalDate_idx" ON "UserPreferenceSignal"("userId", "signalDate");

ALTER TABLE "UserPreferenceSignal" ADD CONSTRAINT "UserPreferenceSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
