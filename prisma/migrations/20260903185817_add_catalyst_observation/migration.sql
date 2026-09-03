-- CreateTable
CREATE TABLE "CatalystObservation" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "currentOutlookScore" DOUBLE PRECISION NOT NULL,
    "catalystChangeScore" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "stockPrice" DOUBLE PRECISION,
    "sectorBenchmark" TEXT,
    "marketBenchmark" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalystObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalystObservation_ticker_eventSlug_observedAt_idx" ON "CatalystObservation"("ticker", "eventSlug", "observedAt");
