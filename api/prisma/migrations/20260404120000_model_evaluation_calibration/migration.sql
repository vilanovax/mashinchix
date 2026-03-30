-- Model evaluation: prediction errors, score validation, recommendation performance, calibration audit

CREATE TABLE "PredictionEvaluation" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "predictionDate" DATE NOT NULL,
    "targetDate" DATE NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "predictedPrice" DECIMAL(18,0) NOT NULL,
    "actualPrice" DECIMAL(18,0),
    "error" DOUBLE PRECISION,
    "absError" DOUBLE PRECISION,
    "pctError" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredictionEvaluation_carId_predictionDate_horizonDays_modelVersion_key" ON "PredictionEvaluation"("carId", "predictionDate", "horizonDays", "modelVersion");
CREATE INDEX "PredictionEvaluation_carId_idx" ON "PredictionEvaluation"("carId");
CREATE INDEX "PredictionEvaluation_targetDate_idx" ON "PredictionEvaluation"("targetDate");
CREATE INDEX "PredictionEvaluation_modelVersion_idx" ON "PredictionEvaluation"("modelVersion");

CREATE TABLE "InvestmentScoreEvaluation" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "investmentScore" DOUBLE PRECISION NOT NULL,
    "return30d" DOUBLE PRECISION,
    "return90d" DOUBLE PRECISION,
    "return180d" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "drawdown" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentScoreEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentScoreEvaluation_carId_snapshotDate_key" ON "InvestmentScoreEvaluation"("carId", "snapshotDate");
CREATE INDEX "InvestmentScoreEvaluation_snapshotDate_idx" ON "InvestmentScoreEvaluation"("snapshotDate");

CREATE TABLE "RiskScoreEvaluation" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "futureVolatility" DOUBLE PRECISION,
    "futureDrawdown" DOUBLE PRECISION,
    "futureReturn" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScoreEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiskScoreEvaluation_carId_snapshotDate_key" ON "RiskScoreEvaluation"("carId", "snapshotDate");
CREATE INDEX "RiskScoreEvaluation_snapshotDate_idx" ON "RiskScoreEvaluation"("snapshotDate");

CREATE TABLE "RecommendationPerformance" (
    "id" TEXT NOT NULL,
    "recommendationSessionId" TEXT NOT NULL,
    "avgReturn7d" DOUBLE PRECISION,
    "avgReturn30d" DOUBLE PRECISION,
    "avgReturn90d" DOUBLE PRECISION,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationPerformance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationPerformance_recommendationSessionId_key" ON "RecommendationPerformance"("recommendationSessionId");

CREATE TABLE "ScoreCalibration" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "oldWeight" DOUBLE PRECISION NOT NULL,
    "newWeight" DOUBLE PRECISION NOT NULL,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCalibration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoreCalibration_modelName_createdAt_idx" ON "ScoreCalibration"("modelName", "createdAt");

ALTER TABLE "PredictionEvaluation" ADD CONSTRAINT "PredictionEvaluation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentScoreEvaluation" ADD CONSTRAINT "InvestmentScoreEvaluation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskScoreEvaluation" ADD CONSTRAINT "RiskScoreEvaluation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationPerformance" ADD CONSTRAINT "RecommendationPerformance_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
