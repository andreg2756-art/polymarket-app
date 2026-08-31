-- AlterTable
ALTER TABLE "StockSnapshot" ADD COLUMN     "lens" TEXT NOT NULL DEFAULT 'speculative';

-- CreateIndex
CREATE INDEX "StockSnapshot_lens_idx" ON "StockSnapshot"("lens");
