-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "cashAndEquivalents" DOUBLE PRECISION,
ADD COLUMN     "freeCashFlow" DOUBLE PRECISION,
ADD COLUMN     "netIncome" DOUBLE PRECISION,
ADD COLUMN     "priceToBook" DOUBLE PRECISION,
ADD COLUMN     "qualityRank" INTEGER,
ADD COLUMN     "qualityScore" DOUBLE PRECISION,
ADD COLUMN     "totalDebt" DOUBLE PRECISION,
ADD COLUMN     "trailingPE" DOUBLE PRECISION,
ADD COLUMN     "turnaroundRank" INTEGER,
ADD COLUMN     "turnaroundScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Stock_qualityRank_idx" ON "Stock"("qualityRank");

-- CreateIndex
CREATE INDEX "Stock_turnaroundRank_idx" ON "Stock"("turnaroundRank");
