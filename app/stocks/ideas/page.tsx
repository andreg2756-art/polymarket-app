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

function convictionRating(s: Stock): { label: string; color: string } {
  if (s.bullishScore >= 70 && s.revenueGrowth > 20) return { label: "Very High", color: "text-emerald-300 bg-emerald-900" };
  if (s.bullishScore >= 55) return { label: "High", color: "text-green-300 bg-green-900" };
  if (s.bullishScore >= 40) return { label: "Medium", color: "text-yellow-300 bg-yellow-900" };
  return { label: "Low", color: "text-gray-300 bg-gray-800" };
}

function riskRating(s: Stock): { label: string; color: string } {
  if (s.marketCap < 200_000_000) return { label: "High Risk", color: "text-red-300 bg-red-900" };
  if (s.marketCap < 500_000_000) return { label: "Med Risk", color: "text-orange-300 bg-orange-900" };
  return { label: "Lower Risk", color: "text-blue-300 bg-blue-900" };
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${conviction.color}`}>{conviction.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
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
