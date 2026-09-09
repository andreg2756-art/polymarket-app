ALTER TABLE "Stock" ADD COLUMN "financialPeriodType" TEXT,
 ADD COLUMN "financialPeriodEnd" TEXT, ADD COLUMN "financialCurrency" TEXT,
 ADD COLUMN "financialSource" TEXT, ADD COLUMN "financialFetchedAt" TIMESTAMP(3),
 ADD COLUMN "qualityDataStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
 ADD COLUMN "valueDataStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
 ADD COLUMN "earningsPeriodEnd" TEXT, ADD COLUMN "lastFilingDate" TEXT;
CREATE TABLE "FinancialRecord" (
 "id" TEXT NOT NULL, "ticker" TEXT NOT NULL, "source" TEXT NOT NULL,
 "periodEnd" TEXT NOT NULL, "periodType" TEXT NOT NULL, "currency" TEXT NOT NULL,
 "payload" JSONB NOT NULL, "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialRecord_ticker_source_periodEnd_key" ON "FinancialRecord"("ticker","source","periodEnd");
CREATE INDEX "FinancialRecord_ticker_periodEnd_idx" ON "FinancialRecord"("ticker","periodEnd");
CREATE TABLE "FinancialJob" (
 "ticker" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastAttemptAt" TIMESTAMP(3),
 "lastSuccessAt" TIMESTAMP(3), "reason" TEXT, CONSTRAINT "FinancialJob_pkey" PRIMARY KEY ("ticker")
);
CREATE TABLE "FinancialWorkerLease" (
 "id" TEXT NOT NULL, "owner" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "FinancialWorkerLease_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinancialSourceResponse" (
 "id" TEXT NOT NULL, "ticker" TEXT NOT NULL, "source" TEXT NOT NULL, "statement" TEXT NOT NULL,
 "payload" JSONB NOT NULL, "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinancialSourceResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialSourceResponse_ticker_source_statement_key" ON "FinancialSourceResponse"("ticker","source","statement");
CREATE TABLE "FinancialRequestBudget" ("id" TEXT NOT NULL, "used" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "FinancialRequestBudget_pkey" PRIMARY KEY ("id"));
