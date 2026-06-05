/*
  Warnings:

  - You are about to drop the `Market` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Outcome` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Outcome" DROP CONSTRAINT "Outcome_marketId_fkey";

-- DropTable
DROP TABLE "Market";

-- DropTable
DROP TABLE "Outcome";

-- CreateTable
CREATE TABLE "Trader" (
    "id" TEXT NOT NULL,
    "proxyWallet" TEXT NOT NULL,
    "username" TEXT,
    "monthlyPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "topTraderCount" INTEGER NOT NULL DEFAULT 0,
    "totalPositions" INTEGER NOT NULL DEFAULT 0,
    "failedUsers" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "RefreshRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL,
    "refreshRunId" TEXT NOT NULL,
    "proxyWallet" TEXT NOT NULL,
    "username" TEXT,
    "conditionId" TEXT NOT NULL,
    "marketTitle" TEXT NOT NULL,
    "slug" TEXT,
    "outcome" TEXT NOT NULL,
    "category" TEXT,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "size" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPositionGroup" (
    "id" TEXT NOT NULL,
    "refreshRunId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "marketTitle" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "category" TEXT,
    "holderCount" INTEGER NOT NULL DEFAULT 0,
    "totalCurrentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCashPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consensusScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPositionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trader_proxyWallet_key" ON "Trader"("proxyWallet");

-- CreateIndex
CREATE INDEX "PositionSnapshot_refreshRunId_idx" ON "PositionSnapshot"("refreshRunId");

-- CreateIndex
CREATE INDEX "PositionSnapshot_conditionId_idx" ON "PositionSnapshot"("conditionId");

-- CreateIndex
CREATE INDEX "PositionSnapshot_proxyWallet_idx" ON "PositionSnapshot"("proxyWallet");

-- CreateIndex
CREATE INDEX "MarketPositionGroup_refreshRunId_idx" ON "MarketPositionGroup"("refreshRunId");

-- CreateIndex
CREATE INDEX "MarketPositionGroup_conditionId_idx" ON "MarketPositionGroup"("conditionId");

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_refreshRunId_fkey" FOREIGN KEY ("refreshRunId") REFERENCES "RefreshRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPositionGroup" ADD CONSTRAINT "MarketPositionGroup_refreshRunId_fkey" FOREIGN KEY ("refreshRunId") REFERENCES "RefreshRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
