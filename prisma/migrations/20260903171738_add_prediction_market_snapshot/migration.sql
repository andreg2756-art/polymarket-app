-- CreateTable
CREATE TABLE "PredictionMarketSnapshot" (
    "id" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionMarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionMarketSnapshot_eventSlug_outcomeId_capturedAt_idx" ON "PredictionMarketSnapshot"("eventSlug", "outcomeId", "capturedAt");
