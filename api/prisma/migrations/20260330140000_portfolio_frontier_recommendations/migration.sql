-- CreateTable
CREATE TABLE "PortfolioFrontier" (
    "id" TEXT NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "return" DOUBLE PRECISION NOT NULL,
    "allocation" JSONB NOT NULL,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioFrontier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPortfolioRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "budget" DECIMAL(18,0),
    "params" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPortfolioRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioFrontier_createdAt_idx" ON "PortfolioFrontier"("createdAt");

-- CreateIndex
CREATE INDEX "UserPortfolioRecommendation_userId_createdAt_idx" ON "UserPortfolioRecommendation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPortfolioRecommendation" ADD CONSTRAINT "UserPortfolioRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
