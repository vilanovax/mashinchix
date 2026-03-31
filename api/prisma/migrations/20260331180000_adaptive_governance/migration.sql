-- CreateEnum
CREATE TYPE "AdaptiveWeightSource" AS ENUM ('MANUAL', 'LEARNING', 'ROLLBACK', 'EXPERIMENT');

-- CreateEnum
CREATE TYPE "AdaptiveEventType" AS ENUM (
  'WEIGHT_UPDATED',
  'MODEL_SWITCHED',
  'GUARDRAIL_CLAMPED',
  'ROLLBACK',
  'FREEZE',
  'UNFREEZE',
  'EXPERIMENT_STARTED',
  'EXPERIMENT_COMPLETED'
);

-- CreateEnum
CREATE TYPE "AdaptiveExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdaptiveWeightVersion" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "source" "AdaptiveWeightSource" NOT NULL DEFAULT 'LEARNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdaptiveWeightVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveEvent" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "eventType" "AdaptiveEventType" NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveControl" (
    "scope" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "rollbackToVersion" INTEGER,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveControl_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "AdaptiveExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "controlVersion" INTEGER NOT NULL,
    "candidateVersion" INTEGER NOT NULL,
    "trafficSplit" DOUBLE PRECISION NOT NULL,
    "successMetric" TEXT NOT NULL,
    "status" "AdaptiveExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveExperimentResult" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "controlValue" DOUBLE PRECISION,
    "candidateValue" DOUBLE PRECISION,
    "winner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveWeightVersion_scope_version_key" ON "AdaptiveWeightVersion"("scope", "version");

-- CreateIndex
CREATE INDEX "AdaptiveWeightVersion_scope_isActive_idx" ON "AdaptiveWeightVersion"("scope", "isActive");

-- CreateIndex
CREATE INDEX "AdaptiveWeightVersion_scope_createdAt_idx" ON "AdaptiveWeightVersion"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveEvent_scope_createdAt_idx" ON "AdaptiveEvent"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveEvent_eventType_createdAt_idx" ON "AdaptiveEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveExperiment_scope_status_idx" ON "AdaptiveExperiment"("scope", "status");

-- CreateIndex
CREATE INDEX "AdaptiveExperimentResult_experimentId_createdAt_idx" ON "AdaptiveExperimentResult"("experimentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdaptiveExperimentResult" ADD CONSTRAINT "AdaptiveExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdaptiveExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
