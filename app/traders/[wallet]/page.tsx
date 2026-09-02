"use client";
import { use } from "react";
import { formatUSD } from "@/lib/analytics";
import { useFetch } from "@/lib/useFetch";
import { Skeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Position {
  id: string;
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string | null;
  currentValue: number;
  size: number;
  cashPnl: number;
  volume: number;
}

interface TraderData {
  trader: {
    proxyWallet: string;
    username: string | null;
    rank: number;
    monthlyPnl: number;
    monthlyVolume: number;
  };
  positions: Position[];
  categoryBreakdown: { category: string; value: number }[];
}

const COLORS = ["#60A5FA", "#34D399", "#F59E0B", "#F87171", "#A78BFA", "#FB923C"];

export default function TraderDetailPage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = use(params);
  const { data, loading, error, reload } = useFetch<TraderData>(`/api/traders/${wallet}`);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (error) return <ErrorState onRetry={reload} />;
  if (!data?.trader) return <div className="py-32 text-center text-gray-500">Trader not found.</div>;

  const { trader, positions, categoryBreakdown } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{trader.username || "Unknown"}</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">{trader.proxyWallet}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase">Monthly PnL</p>
          <p className={`text-xl font-bold ${trader.monthlyPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatUSD(trader.monthlyPnl)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase">Volume</p>
          <p className="text-xl font-bold">{trader.monthlyVolume > 0 ? formatUSD(trader.monthlyVolume) : "N/A"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase">Rank</p>
          <p className="text-xl font-bold">#{trader.rank}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase">Active Positions</p>
          <p className="text-xl font-bold">{positions.length}</p>
        </div>
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">Exposure by Category</h2>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryBreakdown}>
                  <XAxis dataKey="category" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} formatter={(v) => formatUSD(Number(v))} />
                  <Bar dataKey="value" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-3">Capital Distribution</h2>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ name }) => String(name ?? "")}>
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} formatter={(v) => formatUSD(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Positions ({positions.length})</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["Market","Outcome","Category","Current Value","Size","Cash PnL","Volume"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 max-w-[240px]">
                    <a href={`/markets/${p.conditionId}`} className="text-blue-300 hover:underline line-clamp-2">{p.marketTitle}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{p.outcome}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-green-400">{formatUSD(p.currentValue)}</td>
                  <td className="px-4 py-3 text-gray-300">{p.size.toFixed(2)}</td>
                  <td className={`px-4 py-3 ${p.cashPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatUSD(p.cashPnl)}</td>
                  <td className="px-4 py-3 text-gray-400">{p.volume > 0 ? formatUSD(p.volume) : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {positions.length === 0 && <div className="py-12 text-center text-gray-500">No active positions found.</div>}
        </div>
      </section>
    </div>
  );
}
