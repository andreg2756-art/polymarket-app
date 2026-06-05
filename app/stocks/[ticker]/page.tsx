"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import { Skeleton } from "@/components/Skeleton";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

interface StockDetail {
  stock: {
    ticker: string; name: string; sector: string | null; industry: string | null;
    marketCap: number; price: number; bullishScore: number; analystRating: string | null;
    revenueGrowth: number; epsGrowth: number; earningsBeat: boolean; revenueBeat: boolean;
    insiderBuying: number; relativeVolume: number; change1M: number; rank: number;
    lastEarningsDate: string | null; float: number | null; shortInterest: number | null;
    institutionalOwn: number | null;
  };
  news: { id: string; headline: string; publisher: string | null; publishedAt: string | null; url: string; summary: string | null; sentiment: number }[];
  snapshots: { createdAt: string; bullishScore: number; price: number }[];
  profile: { description: string; ceo: string; website: string; fullTimeEmployees: number; image: string } | null;
  income: { date: string; revenue: number; netIncome: number; eps: number }[];
  insiders: { reportingName: string; transactionType: string; securitiesTransacted: number; price: number; transactionDate: string }[];
  analyst: { analystRatingsStrongBuy: number; analystRatingsBuy: number; analystRatingsHold: number; analystRatingsSell: number; analystRatingsStrongSell: number } | null;
  earnings: { date: string; eps: number; epsEstimated: number; revenue: number; revenueEstimated: number }[];
  priceHistory: { date: string; close: number; volume: number }[];
}

function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(n: number) { return isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "N/A"; }

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [data, setData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!data?.stock) return <div className="py-32 text-center text-gray-500">Stock not found.</div>;

  const { stock, news, snapshots, profile, income, insiders, analyst, earnings, priceHistory } = data;

  const totalBuy = (analyst?.analystRatingsStrongBuy ?? 0) + (analyst?.analystRatingsBuy ?? 0);
  const totalSell = (analyst?.analystRatingsSell ?? 0) + (analyst?.analystRatingsStrongSell ?? 0);
  const totalHold = analyst?.analystRatingsHold ?? 0;
  const totalAnalysts = totalBuy + totalSell + totalHold;

  const bullCase = [
    stock.earningsBeat && "Beat earnings estimates last quarter",
    stock.revenueBeat && "Beat revenue estimates last quarter",
    stock.revenueGrowth > 15 && `Revenue growing ${stock.revenueGrowth.toFixed(1)}% YoY`,
    stock.epsGrowth > 20 && `EPS growing ${stock.epsGrowth.toFixed(1)}% YoY`,
    stock.insiderBuying > 0 && `Insider buying activity detected ($${fmtNum(stock.insiderBuying)})`,
    stock.analystRating?.includes("Buy") && `Analyst consensus: ${stock.analystRating}`,
    stock.relativeVolume > 1.5 && `High relative volume (${stock.relativeVolume.toFixed(1)}x average)`,
    stock.change1M > 10 && `Strong 1-month momentum (+${stock.change1M.toFixed(1)}%)`,
  ].filter(Boolean) as string[];

  const bearCase = [
    !stock.earningsBeat && "Missed earnings estimates recently",
    stock.revenueGrowth < 0 && `Revenue declining ${Math.abs(stock.revenueGrowth).toFixed(1)}% YoY`,
    stock.shortInterest && stock.shortInterest > 10 && `High short interest (${stock.shortInterest.toFixed(1)}%)`,
    stock.change1M < -10 && `Weak price action (${stock.change1M.toFixed(1)}% last month)`,
    totalAnalysts > 0 && totalSell > totalBuy && `More sell ratings than buy ratings`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-emerald-400">{ticker}</h1>
            <span className={`text-sm px-3 py-1 rounded-full font-semibold ${stock.bullishScore >= 70 ? "bg-emerald-900 text-emerald-300" : "bg-blue-900 text-blue-300"}`}>
              Score {stock.bullishScore}
            </span>
            <span className="text-sm text-gray-500">Rank #{stock.rank}</span>
          </div>
          <p className="text-xl text-gray-300 mt-1">{stock.name}</p>
          <p className="text-gray-500 text-sm">{stock.sector} · {stock.industry}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">${fmtNum(stock.price)}</p>
          <p className={`text-sm ${stock.change1M >= 0 ? "text-emerald-400" : "text-red-400"}`}>{stock.change1M >= 0 ? "+" : ""}{stock.change1M.toFixed(1)}% (1M)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Market Cap", value: fmtCap(stock.marketCap) },
          { label: "Rev Growth", value: `${stock.revenueGrowth >= 0 ? "+" : ""}${stock.revenueGrowth.toFixed(1)}%` },
          { label: "EPS Growth", value: `${stock.epsGrowth >= 0 ? "+" : ""}${stock.epsGrowth.toFixed(1)}%` },
          { label: "Analyst Rating", value: stock.analystRating ?? "N/A" },
          { label: "Insider Buying", value: stock.insiderBuying > 0 ? `$${fmtNum(stock.insiderBuying)}` : "None" },
          { label: "Rel. Volume", value: `${stock.relativeVolume.toFixed(1)}x` },
          { label: "Float", value: stock.float ? fmtNum(stock.float) : "N/A" },
          { label: "Last Earnings", value: stock.lastEarningsDate ?? "N/A" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">{item.label}</p>
            <p className="text-lg font-semibold mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {profile?.description && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{profile.description.slice(0, 600)}{profile.description.length > 600 ? "..." : ""}</p>
          {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs mt-2 inline-block hover:underline">{profile.website}</a>}
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-gray-900 border border-emerald-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-emerald-400 mb-3">🐂 Bull Case</h2>
          {bullCase.length ? (
            <ul className="space-y-2">
              {bullCase.map((b, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-emerald-500 mt-0.5">✓</span>{b}</li>)}
            </ul>
          ) : <p className="text-gray-600 text-sm">No strong bullish signals detected.</p>}
        </section>
        <section className="bg-gray-900 border border-red-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-red-400 mb-3">🐻 Bear Case</h2>
          {bearCase.length ? (
            <ul className="space-y-2">
              {bearCase.map((b, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-red-500 mt-0.5">✗</span>{b}</li>)}
            </ul>
          ) : <p className="text-gray-600 text-sm">No major bearish signals detected.</p>}
        </section>
      </div>

      {priceHistory.length > 1 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Price (90 Days)</h2>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]} />
                <Line type="monotone" dataKey="close" stroke="#34d399" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {income.length > 1 && (
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">Revenue History</h2>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[...income].reverse()}>
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.slice(0, 7)} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} formatter={(v) => [`$${(Number(v) / 1e6).toFixed(1)}M`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-3">EPS History</h2>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[...income].reverse()}>
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.slice(0, 7)} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="eps" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {earnings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Earnings History</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>{["Date","EPS","EPS Est","Beat","Revenue","Rev Est","Beat"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {earnings.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-gray-400">{e.date}</td>
                    <td className="px-4 py-3">${fmtNum(e.eps)}</td>
                    <td className="px-4 py-3 text-gray-500">${fmtNum(e.epsEstimated)}</td>
                    <td className="px-4 py-3">{e.eps > e.epsEstimated ? <span className="text-emerald-400">✓ Beat</span> : <span className="text-red-400">✗ Miss</span>}</td>
                    <td className="px-4 py-3">${(e.revenue / 1e6).toFixed(1)}M</td>
                    <td className="px-4 py-3 text-gray-500">${(e.revenueEstimated / 1e6).toFixed(1)}M</td>
                    <td className="px-4 py-3">{e.revenue > e.revenueEstimated ? <span className="text-emerald-400">✓ Beat</span> : <span className="text-red-400">✗ Miss</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {analyst && totalAnalysts > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Analyst Ratings ({totalAnalysts} analysts)</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 flex-wrap">
            {[
              { label: "Strong Buy", count: analyst.analystRatingsStrongBuy, color: "text-emerald-400" },
              { label: "Buy", count: analyst.analystRatingsBuy, color: "text-green-400" },
              { label: "Hold", count: analyst.analystRatingsHold, color: "text-yellow-400" },
              { label: "Sell", count: analyst.analystRatingsSell, color: "text-orange-400" },
              { label: "Strong Sell", count: analyst.analystRatingsStrongSell, color: "text-red-400" },
            ].map((r) => (
              <div key={r.label} className="text-center min-w-[80px]">
                <p className={`text-2xl font-bold ${r.color}`}>{r.count}</p>
                <p className="text-xs text-gray-500">{r.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {insiders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Insider Transactions</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>{["Name","Type","Shares","Price","Value","Date"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {insiders.slice(0, 10).map((ins, i) => {
                  const isBuy = ins.transactionType?.includes("Purchase") || ins.transactionType === "P-Purchase";
                  return (
                    <tr key={i} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-gray-300">{ins.reportingName}</td>
                      <td className={`px-4 py-3 font-medium ${isBuy ? "text-emerald-400" : "text-red-400"}`}>{ins.transactionType}</td>
                      <td className="px-4 py-3 text-gray-300">{ins.securitiesTransacted.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">${fmtNum(ins.price)}</td>
                      <td className="px-4 py-3 text-gray-300">${fmtNum(ins.securitiesTransacted * ins.price)}</td>
                      <td className="px-4 py-3 text-gray-500">{ins.transactionDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Coverage</h2>
          <div className="space-y-3">
            {news.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-200 hover:text-white">{n.headline}</p>
                    {n.summary && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{n.summary}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{n.publisher}</p>
                    <p className="text-xs text-gray-600">{n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : ""}</p>
                    {n.sentiment !== 0 && (
                      <span className={`text-xs ${n.sentiment > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {n.sentiment > 0 ? "Positive" : "Negative"}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
