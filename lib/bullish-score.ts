import type { FMPAnalystRating, FMPEarnings, FMPIncomeStatement, FMPInsiderTrade, FMPNews, FMPQuote } from "./fmp";

export interface ScoreInputs {
  quote: FMPQuote | null;
  earnings: FMPEarnings[];
  income: FMPIncomeStatement[];
  insiders: FMPInsiderTrade[];
  analyst: FMPAnalystRating | null;
  news: FMPNews[];
}

export interface ScoreBreakdown {
  bullishScore: number;
  earningsBeat: boolean;
  revenueBeat: boolean;
  guidanceUp: boolean;
  revenueGrowth: number;
  epsGrowth: number;
  relativeVolume: number;
  insiderBuying: number;
  analystRating: string;
  analystCount: number;
  change1M: number;
  change3M: number;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function sentimentScore(news: FMPNews[]): number {
  if (!news.length) return 50;
  let score = 0;
  for (const n of news) {
    const text = (n.title + " " + (n.text ?? "")).toLowerCase();
    const positive = ["beat", "surpass", "record", "growth", "upgrade", "bullish", "strong", "raise", "accelerat", "partnership", "win", "contract", "expand"];
    const negative = ["miss", "disappoint", "downgrade", "bearish", "weak", "cut", "decline", "loss", "dilut", "lawsuit", "recall", "warning"];
    let s = 0;
    for (const w of positive) if (text.includes(w)) s += 10;
    for (const w of negative) if (text.includes(w)) s -= 10;
    score += s;
  }
  return clamp(50 + score / news.length);
}

export function computeBullishScore(inputs: ScoreInputs): ScoreBreakdown {
  const { quote, earnings, income, insiders, analyst, news } = inputs;

  // Earnings beat (15 pts)
  const lastEarnings = earnings[0];
  const earningsBeat = lastEarnings ? lastEarnings.eps > lastEarnings.epsEstimated : false;
  const revenueBeat = lastEarnings ? lastEarnings.revenue > lastEarnings.revenueEstimated : false;
  const earningsScore = (earningsBeat ? 10 : 0) + (revenueBeat ? 5 : 0);

  // Revenue growth (15 pts)
  const revenueGrowth = income.length >= 2
    ? ((income[0].revenue - income[1].revenue) / Math.abs(income[1].revenue || 1)) * 100
    : 0;
  const revenueScore = clamp(revenueGrowth > 30 ? 15 : revenueGrowth > 15 ? 10 : revenueGrowth > 0 ? 5 : 0, 0, 15);

  // EPS growth (10 pts)
  const epsGrowth = income.length >= 2 && income[1].eps !== 0
    ? ((income[0].eps - income[1].eps) / Math.abs(income[1].eps)) * 100
    : 0;
  const epsScore = clamp(epsGrowth > 50 ? 10 : epsGrowth > 20 ? 7 : epsGrowth > 0 ? 4 : 0, 0, 10);

  // Analyst rating (15 pts)
  let analystRating = "N/A";
  let analystCount = 0;
  let analystScore = 0;
  if (analyst) {
    const buy = (analyst.analystRatingsStrongBuy ?? 0) + (analyst.analystRatingsBuy ?? 0);
    const sell = (analyst.analystRatingsSell ?? 0) + (analyst.analystRatingsStrongSell ?? 0);
    const hold = analyst.analystRatingsHold ?? 0;
    analystCount = buy + sell + hold;
    if (analystCount > 0) {
      const buyPct = buy / analystCount;
      analystScore = clamp(buyPct * 15, 0, 15);
      analystRating = buyPct > 0.7 ? "Strong Buy" : buyPct > 0.5 ? "Buy" : buyPct > 0.3 ? "Hold" : "Sell";
    }
  }

  // Insider buying (15 pts)
  const buys = insiders.filter((t) => t.transactionType?.toLowerCase().includes("purchase") || t.transactionType === "P-Purchase");
  const sells = insiders.filter((t) => t.transactionType?.toLowerCase().includes("sale") || t.transactionType === "S-Sale");
  const insiderBuying = buys.reduce((s, t) => s + (t.securitiesTransacted * t.price), 0);
  const insiderSelling = sells.reduce((s, t) => s + (t.securitiesTransacted * t.price), 0);
  const insiderScore = insiderBuying > insiderSelling ? clamp((insiderBuying / Math.max(insiderBuying + insiderSelling, 1)) * 15, 0, 15) : 0;

  // Relative volume (10 pts)
  const relativeVolume = quote ? (quote.volume / Math.max(quote.avgVolume, 1)) : 1;
  const volumeScore = clamp((relativeVolume - 1) * 5, 0, 10);

  // News sentiment (10 pts)
  const newsScore = clamp((sentimentScore(news) - 50) / 5, 0, 10);

  // Price trend (10 pts)
  const change1M = quote?.changesPercentage ?? 0;
  const change3M = 0;
  const trendScore = clamp(change1M > 20 ? 10 : change1M > 10 ? 7 : change1M > 0 ? 4 : 0, 0, 10);

  const bullishScore = Math.round(
    earningsScore + revenueScore + epsScore + analystScore + insiderScore + volumeScore + newsScore + trendScore
  );

  return {
    bullishScore: clamp(bullishScore),
    earningsBeat,
    revenueBeat,
    guidanceUp: false,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    epsGrowth: Math.round(epsGrowth * 10) / 10,
    relativeVolume: Math.round(relativeVolume * 10) / 10,
    insiderBuying,
    analystRating,
    analystCount,
    change1M: Math.round(change1M * 10) / 10,
    change3M,
  };
}
