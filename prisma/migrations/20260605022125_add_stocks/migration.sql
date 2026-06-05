-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change1M" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change3M" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "epsGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analystRating" TEXT,
    "analystCount" INTEGER NOT NULL DEFAULT 0,
    "bullishScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastEarningsDate" TEXT,
    "float" DOUBLE PRECISION,
    "shortInterest" DOUBLE PRECISION,
    "institutionalOwn" DOUBLE PRECISION,
    "insiderBuying" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relativeVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsBeat" BOOLEAN NOT NULL DEFAULT false,
    "revenueBeat" BOOLEAN NOT NULL DEFAULT false,
    "guidanceUp" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSnapshot" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "bullishScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockNews" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "sentiment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "listName" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");

-- CreateIndex
CREATE INDEX "Stock_bullishScore_idx" ON "Stock"("bullishScore");

-- CreateIndex
CREATE INDEX "Stock_rank_idx" ON "Stock"("rank");

-- CreateIndex
CREATE INDEX "StockSnapshot_ticker_idx" ON "StockSnapshot"("ticker");

-- CreateIndex
CREATE INDEX "StockNews_ticker_idx" ON "StockNews"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_ticker_listName_key" ON "WatchlistItem"("ticker", "listName");

-- AddForeignKey
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Stock"("ticker") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockNews" ADD CONSTRAINT "StockNews_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Stock"("ticker") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Stock"("ticker") ON DELETE CASCADE ON UPDATE CASCADE;
