-- CreateEnum
CREATE TYPE "TriggerEngineType" AS ENUM (
  'PRICE_DROP_THRESHOLD',
  'PRICE_SPIKE',
  'VOLATILITY_SPIKE',
  'LIQUIDITY_DROP',
  'DEMAND_SPIKE',
  'SIGNAL_CHANGE',
  'STRATEGY_CHANGE',
  'PORTFOLIO_DRIFT',
  'WATCHLIST_HIT',
  'OPPORTUNITY_DETECTED',
  'RISK_INCREASE',
  'SEGMENT_ROTATION',
  'MARKET_CYCLE_CHANGE'
);

-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE 'TRIGGER_ENGINE';

-- AlterTable
ALTER TABLE "UserNotification" ADD COLUMN "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "UserNotification" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE INDEX "UserNotification_userId_dedupeKey_idx" ON "UserNotification"("userId", "dedupeKey");

-- CreateTable
CREATE TABLE "TriggerRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TriggerEngineType" NOT NULL,
    "condition" JSONB NOT NULL DEFAULT '{}',
    "threshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRule_name_key" ON "TriggerRule"("name");

-- CreateIndex
CREATE INDEX "TriggerRule_type_isActive_idx" ON "TriggerRule"("type", "isActive");

-- CreateTable
CREATE TABLE "TriggerEvent" (
    "id" TEXT NOT NULL,
    "type" "TriggerEngineType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "carId" TEXT,
    "segment" TEXT,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriggerEvent_type_createdAt_idx" ON "TriggerEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerEvent_userId_createdAt_idx" ON "TriggerEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerEvent_carId_idx" ON "TriggerEvent"("carId");

-- CreateIndex
CREATE INDEX "TriggerEvent_segment_idx" ON "TriggerEvent"("segment");

-- AddForeignKey
ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
