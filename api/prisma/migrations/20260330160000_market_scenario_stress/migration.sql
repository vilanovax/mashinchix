-- CreateTable
CREATE TABLE "MarketScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceChangePct" DOUBLE PRECISION NOT NULL,
    "volatilityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "liquidityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "demandMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "segmentOverrides" JSONB,
    "durationDays" INTEGER NOT NULL DEFAULT 252,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioStressTest" (
    "id" TEXT NOT NULL,
    "portfolio" JSONB NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "finalReturn" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "recoveryTimeDays" INTEGER,
    "lossProbability" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "worstCase" DOUBLE PRECISION,
    "bestCase" DOUBLE PRECISION,
    "survivalProbability" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioStressTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyScenarioPerformance" (
    "id" TEXT NOT NULL,
    "strategyName" "BacktestStrategyName" NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "finalReturn" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "survivalProbability" DOUBLE PRECISION,
    "timeToRecoveryDays" INTEGER,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyScenarioPerformance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketScenario_name_idx" ON "MarketScenario"("name");

CREATE INDEX "PortfolioStressTest_scenarioId_createdAt_idx" ON "PortfolioStressTest"("scenarioId", "createdAt");

CREATE UNIQUE INDEX "StrategyScenarioPerformance_strategyName_scenarioId_key" ON "StrategyScenarioPerformance"("strategyName", "scenarioId");

CREATE INDEX "StrategyScenarioPerformance_scenarioId_idx" ON "StrategyScenarioPerformance"("scenarioId");

-- AddForeignKey
ALTER TABLE "PortfolioStressTest" ADD CONSTRAINT "PortfolioStressTest_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MarketScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyScenarioPerformance" ADD CONSTRAINT "StrategyScenarioPerformance_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MarketScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- نمونهٔ سناریوها (شناسهٔ ثابت برای ارجاع در API)
INSERT INTO "MarketScenario" ("id","name","description","priceChangePct","volatilityMultiplier","liquidityMultiplier","demandMultiplier","segmentOverrides","durationDays","createdAt") VALUES
('scen_market_crash', 'Market Crash', 'شوک شدید بازار: افت قیمت، نوسان بسیار بالا، فشار نقدشوندگی', -35, 2.5, 0.45, 0.55, NULL, 120, CURRENT_TIMESTAMP),
('scen_bull_market', 'Bull Market', 'بازار صعودی با تقاضای قوی و نقدشوندگی خوب', 28, 1.05, 1.15, 1.2, NULL, 180, CURRENT_TIMESTAMP),
('scen_bear_market', 'Bear Market', 'بازار نزولی طولانی با تقاضای ضعیف‌تر', -18, 1.75, 0.72, 0.68, NULL, 150, CURRENT_TIMESTAMP),
('scen_liquidity_crisis', 'Liquidity Crisis', 'فشار فروش و نقدشوندگی بسیار پایین', -12, 1.6, 0.32, 0.75, NULL, 90, CURRENT_TIMESTAMP),
('scen_high_inflation', 'High Inflation', 'فشار تورمی، نوسان و ریسک سیستمی بیشتر', -8, 2.1, 0.88, 0.82, NULL, 252, CURRENT_TIMESTAMP),
('scen_segment_boom', 'Segment Boom', 'رونق شدید در برخی سگمنت‌ها (در شبیه‌سازی با JSON اعمال می‌شود)', 5, 1.15, 1.1, 1.25, '{"*":{"priceChangePct":22}}', 120, CURRENT_TIMESTAMP),
('scen_segment_crash', 'Segment Crash', 'سقوط متمرکز در سگمنت‌های آسیب‌پذیر', -10, 1.9, 0.55, 0.5, '{"*":{"priceChangePct":-28}}', 100, CURRENT_TIMESTAMP),
('scen_high_vol', 'High Volatility', 'نوسان شدید بدون روند قیمت مشخص', 0, 3.0, 0.95, 1.0, NULL, 90, CURRENT_TIMESTAMP),
('scen_low_liquidity', 'Low Liquidity', 'نقدشوندگی پایین و زمان فروش طولانی‌تر', -5, 1.25, 0.38, 0.88, NULL, 120, CURRENT_TIMESTAMP),
('scen_prediction_error', 'Prediction Error', 'خطای سیستماتیک پیش‌بینی (بدبینی نسبت به مدل)', -10, 1.45, 1.0, 1.0, NULL, 180, CURRENT_TIMESTAMP),
('scen_drop_10', 'Price Drop 10%', 'استرس افت ۱۰٪ قیمت', -10, 1.0, 1.0, 1.0, NULL, 60, CURRENT_TIMESTAMP),
('scen_drop_20', 'Price Drop 20%', 'استرس افت ۲۰٪ قیمت', -20, 1.1, 0.92, 0.95, NULL, 90, CURRENT_TIMESTAMP),
('scen_drop_30', 'Price Drop 30%', 'استرس افت ۳۰٪ قیمت', -30, 1.35, 0.85, 0.88, NULL, 120, CURRENT_TIMESTAMP),
('scen_liquidity_half', 'Liquidity Drop 50%', 'نصف شدن نقدشوندگی مؤثر', -3, 1.2, 0.5, 0.95, NULL, 90, CURRENT_TIMESTAMP),
('scen_vol_double', 'Volatility x2', 'دو برابر شدن نوسان نسبت به پایه', 2, 2.0, 1.0, 1.0, NULL, 120, CURRENT_TIMESTAMP),
('scen_demand_collapse', 'Demand Collapse', 'سقوش تقاضا', -15, 1.5, 0.82, 0.35, NULL, 120, CURRENT_TIMESTAMP),
('scen_sideways', 'Sideways Market', 'بازار رنج با نوسان معمولی', 1, 1.15, 1.0, 1.0, NULL, 180, CURRENT_TIMESTAMP);
