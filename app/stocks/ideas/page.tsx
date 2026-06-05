"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

interface Stock {
  id: string; ticker: string; name: string; sector: string | null;
  marketCap: number; price: number; bullishScore: number;
  revenueGrowth: number; epsGrowth: number; analystRating: string | null;
  insiderBuying: number; change1M: number; change3M: number;
  relativeVolume: number; earningsBeat: boolean; revenueBeat: boolean;
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function fmtCapShort(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return "N/A";
}

function sectorContext(sector: string | null): string {
  const map: Record<string, string> = {
    Technology: "The technology sector is driven by innovation cycles, interest rate sensitivity, and earnings growth. Small-cap tech names can see rapid multiple expansion when growth accelerates.",
    Healthcare: "Healthcare stocks are influenced by clinical trial results, FDA approvals, and pricing policy. Small-cap biotechs carry binary event risk but can deliver outsized returns on catalysts.",
    Energy: "Energy names are highly correlated to commodity prices and macroeconomic conditions. Clean energy small-caps are additionally driven by policy tailwinds and capital deployment cycles.",
    Financials: "Financial small-caps are sensitive to interest rate changes and credit conditions. Fintech disruptors in this space can scale quickly but face regulatory and competition risk.",
    "Consumer Discretionary": "Consumer discretionary names follow consumer spending trends, credit cycles, and sentiment. Small-cap names here can be volatile around earnings and macro data.",
    Industrials: "Industrials are tied to capex cycles, infrastructure spending, and global trade. Defense and aerospace small-caps can benefit from government contract pipelines.",
    Materials: "Materials stocks — especially metals and miners — are driven by commodity supply/demand, currency moves, and geopolitical events. High beta to risk-on/risk-off cycles.",
    "Communication Services": "Communication services small-caps are platform-driven businesses where user growth and monetization are key. Can re-rate quickly on engagement metrics.",
    "Real Estate": "Real estate small-caps are sensitive to interest rates, credit availability, and regional housing dynamics. REITs offer yield but compress when rates rise.",
    Utilities: "Utilities including clean energy are defensive with predictable cash flows. Growth-oriented clean energy utilities can attract premium valuations on long-term contracts.",
  };
  return map[sector ?? ""] ?? "This sector experiences cyclical trends driven by macro conditions and sector-specific catalysts.";
}

function convictionRating(s: Stock): { label: string; color: string; tooltip: string } {
  const mom = `${s.ticker} has moved ${s.change1M >= 0 ? "+" : ""}${s.change1M.toFixed(1)}% over the past month and ${s.change3M >= 0 ? "+" : ""}${s.change3M.toFixed(1)}% over 3 months`;
  const vol = s.relativeVolume > 1.5 ? `Volume is running at ${s.relativeVolume.toFixed(1)}x its 20-day average, suggesting accumulation.` : s.relativeVolume < 0.8 ? `Volume is below average at ${s.relativeVolume.toFixed(1)}x, indicating limited interest.` : `Volume is near average at ${s.relativeVolume.toFixed(1)}x.`;
  const capCtx = `At ${fmtCapShort(s.marketCap)}, ${s.ticker} is a ${s.marketCap >= 2e9 ? "mid-cap" : s.marketCap >= 300e6 ? "small-cap" : "micro-cap"} in the ${s.sector ?? "market"}.`;
  const secCtx = sectorContext(s.sector);

  if (s.bullishScore >= 70) return {
    label: "Very High",
    color: "text-emerald-300 bg-emerald-900",
    tooltip: `Very High Conviction (${s.bullishScore}/100) — ${mom}, placing it among the top momentum names scanned. ${vol} ${capCtx} ${secCtx} All three scoring factors — 1M momentum, 3M trend, and volume — are firing simultaneously, a rare alignment that historically precedes continued outperformance.`,
  };
  if (s.bullishScore >= 55) return {
    label: "High",
    color: "text-green-300 bg-green-900",
    tooltip: `High Conviction (${s.bullishScore}/100) — ${mom}. ${vol} ${capCtx} ${secCtx} The trend is intact with most bullish signals aligned. One or two factors are slightly below peak levels but the overall setup remains favorable for a staged entry.`,
  };
  if (s.bullishScore >= 40) return {
    label: "Medium",
    color: "text-yellow-300 bg-yellow-900",
    tooltip: `Medium Conviction (${s.bullishScore}/100) — ${mom}. ${vol} ${capCtx} ${secCtx} The setup shows promise but lacks full confirmation. Either short-term momentum or 3-month trend is mixed. Watch for a breakout on volume before adding a full position.`,
  };
  return {
    label: "Low",
    color: "text-gray-300 bg-gray-800",
    tooltip: `Low Conviction (${s.bullishScore}/100) — ${mom}. ${vol} ${capCtx} ${secCtx} Signals are weak or conflicting. The stock is on the watchlist but does not yet meet the criteria for an actionable entry. Revisit after next scan.`,
  };
}

function riskRating(s: Stock): { label: string; color: string; tooltip: string } {
  const capCtx = `${s.ticker} has a market cap of ${fmtCapShort(s.marketCap)}`;
  const drawdownRisk = s.change3M > 50 ? `The stock is up ${s.change3M.toFixed(1)}% over 3 months — a sharp pullback or mean reversion is a real near-term risk.` : s.change3M < -20 ? `The stock is down ${Math.abs(s.change3M).toFixed(1)}% over 3 months — further downside is possible if the trend doesn't reverse.` : "";
  const secCtx = sectorContext(s.sector);

  if (s.marketCap < 200_000_000) return {
    label: "High Risk",
    color: "text-red-300 bg-red-900",
    tooltip: `High Risk — ${capCtx}, classifying it as a micro-cap. Micro-caps carry elevated liquidity risk — wide spreads and thin order books mean exits can be costly during selloffs. ${s.sector ? `Within the ${s.sector} sector: ${secCtx}` : ""} ${drawdownRisk} Recommended position size: 0.5–1% of portfolio max. Always use a defined stop-loss.`,
  };
  if (s.marketCap < 500_000_000) return {
    label: "Med Risk",
    color: "text-orange-300 bg-orange-900",
    tooltip: `Medium Risk — ${capCtx}, placing it in small-cap territory. Small-caps offer higher return potential than large-caps but experience sharper drawdowns during risk-off periods. ${s.sector ? `In the ${s.sector} sector: ${secCtx}` : ""} ${drawdownRisk} Suggested position size: 1–2% of portfolio with a clear exit plan.`,
  };
  return {
    label: "Lower Risk",
    color: "text-blue-300 bg-blue-900",
    tooltip: `Lower Risk — ${capCtx}, making it one of the larger names in this screener. Better liquidity and broader institutional ownership reduce gap-down risk compared to micro-caps. ${s.sector ? `In the ${s.sector} sector: ${secCtx}` : ""} ${drawdownRisk} A standard 2–4% position is appropriate for qualified investors with appropriate risk tolerance.`,
  };
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-0 mb-2 w-96 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
