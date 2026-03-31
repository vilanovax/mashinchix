-- User behavior, feedback, and aggregated behavior profile

CREATE TABLE "UserAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "planId" TEXT,
    "executionId" TEXT,
    "assetId" TEXT,
    "action" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBehaviorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskTolerance" DOUBLE PRECISION,
    "panicSellScore" DOUBLE PRECISION,
    "holdDuration" DOUBLE PRECISION,
    "diversificationPref" DOUBLE PRECISION,
    "liquidityPref" DOUBLE PRECISION,
    "momentumPref" DOUBLE PRECISION,
    "valuePref" DOUBLE PRECISION,
    "confidenceTrust" DOUBLE PRECISION,
    "overrideRate" DOUBLE PRECISION,
    "segmentPreferences" JSONB,
    "strategyPreferences" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBehaviorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserDecisionFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDecisionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAction_userId_createdAt_idx" ON "UserAction"("userId", "createdAt");
CREATE INDEX "UserAction_planId_idx" ON "UserAction"("planId");

CREATE UNIQUE INDEX "UserBehaviorProfile_userId_key" ON "UserBehaviorProfile"("userId");

CREATE INDEX "UserDecisionFeedback_userId_decisionId_idx" ON "UserDecisionFeedback"("userId", "decisionId");
CREATE INDEX "UserDecisionFeedback_decisionId_idx" ON "UserDecisionFeedback"("decisionId");

ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ExecutionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ExecutionResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserBehaviorProfile" ADD CONSTRAINT "UserBehaviorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDecisionFeedback" ADD CONSTRAINT "UserDecisionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDecisionFeedback" ADD CONSTRAINT "UserDecisionFeedback_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
