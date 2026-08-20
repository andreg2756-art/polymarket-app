-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN     "lastAlertedAt" TIMESTAMP(3),
ADD COLUMN     "targetPrice" DOUBLE PRECISION,
ADD COLUMN     "targetScore" DOUBLE PRECISION;
