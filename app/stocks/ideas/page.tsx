"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

interface Stock {
  id: string; ticker: string; name: string; sector: string | null;
  marketCap: number; price: number; bullishScore: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string | null;
  insiderBuying: number; change1M: number; earningsBeat: boolean; revenueBeat: boolean;
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function convictionRating(s: Stock): { label: string; color: string; tooltip: string } {
  if (s.bullishScore >= 70 && s.revenueGrowth > 20) return {
    label: "Very High",
    color: "text-emerald-300 bg-emerald-900",
    tooltip: `Very High conviction — bullish score of ${s.bullishScore}/100 combined with strong revenue growth of +${s.revenueGrowth.toFixed(1)}% signals a high-probability setup. Price momentum is strong across both 1-month and 3-month timeframes with above-average volume confirming institutional interest.`,
  };
  if (s.bullishScore >= 55) return {
    label: "High",
    color: "text-green-300 bg-green-900",
    tooltip: `High conviction — bullish score of ${s.bullishScore}/100 reflects solid price momentum and favorable technicals. The stock is trending above key moving averages with consistent buying pressure. Suitable for a full-size position within your risk parameters.`,
  };
  if (s.bullishScore >= 40) return {
    label: "Medium",
    color: "text-yellow-300 bg-yellow-900",
    tooltip: `Medium conviction — bullish score of ${s.bullishScore}/100 shows mixed signals. Some positive momentum exists but lacks the volume confirmation or sustained trend strength seen in higher-conviction ideas. Consider a smaller initial position with room to add on confirmation.`,
  };
  return {
    label: "Low",
    color: "text-gray-300 bg-gray-800",
    tooltip: `Low conviction — bullish score of ${s.bullishScore}/100 indicates weak or inconsistent signals. Price action is not yet trending clearly, and volume does not confirm accumulation. Monitor for improving momentum before committing capital.`,
  };
}

function riskRating(s: Stock): { label: string; color: string; tooltip: string } {
  if (s.marketCap < 200_000_000) return {
    label: "High Risk",
    color: "text-red-300 bg-red-900",
    tooltip: `High Risk — market cap of $${(s.marketCap / 1e6).toFixed(0)}M places this in micro-cap territory. Micro-caps are subject to high volatility, low liquidity, and wide bid-ask spreads. A single adverse event can cause outsized moves. Position sizing should be kept small (0.5–1% of portfolio max) and stop-losses are strongly recommended.`,
  };
  if (s.marketCap < 500_000_000) return {
    label: "Med Risk",
    color: "text-orange-300 bg-orange-900",
    tooltip: `Medium Risk — market cap of $${(s.marketCap / 1e6).toFixed(0)}M is in small-cap range. Liquidity is moderate and the stock can experience sharp swings on earnings or sector news. Suitable for risk-tolerant investors. Suggested position: 1–2% of portfolio with defined exit levels.`,
  };
  return {
    label: "Lower Risk",
    color: "text-blue-300 bg-blue-900",
    tooltip: `Lower Risk — market cap of $${(s.marketCap / 1e9).toFixed(2)}B provides better liquidity and more institutional coverage than micro or nano caps. While still subject to small-cap volatility, the larger float reduces the risk of extreme gap moves. A standard 2–4% position size is reasonable for qualified investors.`,
  };
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-0 mb-2 w-72 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {text}
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-700" />
      </div>
    </div>
  );
}

function positionSizing(s: Stock): string {
  if (s.bullishScore >= 70) return "2–4% portfolio";
  if (s.bullishScore >= 55) return "1–2% portfolio";
  return "0.5–1% portfolio";
}

export default function IdeasPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stocks/screener?sortBy=bullishScore&minScore=40")
      .then((r) => r.json())
      .then((data) => setStocks(data.slice(0, 20)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-emerald-400">Highest Conviction Ideas</h1>
        <p className="text-gray-500 text-sm mt-1">Top small-cap opportunities ranked by bullish score, risk, and conviction</p>
      </div>

      {stocks.length === 0 ? (
        <div className="py-24 text-center text-gray-500">No ideas yet. Run a market scan first from the Top 50 page.</div>
      ) : (
        <div className="space-y-4">
          {stocks.map((s, i) => {
            const conviction = convictionRating(s);
            const risk = riskRating(s);
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-600">#{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/stocks/${s.ticker}`} className="text-xl font-bold text-emerald-400 hover:underline">{s.ticker}</Link>
                        <Tooltip text={conviction.tooltip}>
                          <span className={`text-xs px-2 py-0.5 rounded-full cursor-help ${conviction.color}`}>{conviction.label}</span>
                        </Tooltip>
                        <Tooltip text={risk.tooltip}>
                          <span className={`text-xs px-2 py-0.5 rounded-full cursor-help ${risk.color}`}>{risk.label}</span>
                        </Tooltip>
                      </div>
                      <p className="text-gray-400 text-sm">{s.name} · {s.sector || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Score</p>
                      <p className="text-xl font-bold text-emerald-400">{s.bullishScore}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="text-lg font-semibold">${s.price.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Mkt Cap</p>
                      <p className="text-sm">{fmtCap(s.marketCap)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Position Size</p>
                      <p className="text-sm text-blue-400">{positionSizing(s)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.earningsBeat && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">Earnings Beat</span>}
                  {s.revenueBeat && <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">Revenue Beat</span>}
                  {s.revenueGrowth > 20 && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">Rev +{s.revenueGrowth.toFixed(0)}%</span>}
                  {s.insiderBuying > 0 && <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">Insider Buying</span>}
                  {s.analystRating?.includes("Buy") && <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded">{s.analystRating}</span>}
                  {s.change1M > 10 && <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded">+{s.change1M.toFixed(0)}% (1M)</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
