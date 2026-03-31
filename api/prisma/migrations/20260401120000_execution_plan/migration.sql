-- CreateTable
CREATE TABLE "ExecutionPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "planDate" DATE NOT NULL,
    "actions" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "expectedReturn" DOUBLE PRECISION,
    "expectedRisk" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "simulation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionPlan_userId_planDate_idx" ON "ExecutionPlan"("userId", "planDate");

-- CreateIndex
CREATE INDEX "ExecutionPlan_planDate_idx" ON "ExecutionPlan"("planDate");

-- AddForeignKey
ALTER TABLE "ExecutionPlan" ADD CONSTRAINT "ExecutionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
