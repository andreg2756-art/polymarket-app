"use client";
import { use } from "react";
import { formatUSD } from "@/lib/analytics";
import { useFetch } from "@/lib/useFetch";
import { Skeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Position {
  id: string;
  proxyWallet: string;
  username: string | null;
  outcome: string;
  currentValue: number;
  size: number;
  cashPnl: number;
  volume: number;
}

interface Group {
  id: string;
  marketTitle: string;
  outcome: string;
  holderCount: number;
  totalCurrentValue: number;
  consensusScore: number;
}

interface TimelineEntry {
  id: string;
  outcome: string;
  holderCount: number;
  totalCurrentValue: number;
  consensusScore: number;
  createdAt: string;
  refreshRunId: string;
}

interface MarketData {
  groups: Group[];
  positions: Position[];
  timeline: TimelineEntry[];
  runs: { id: string; completedAt: string | null }[];
}

export default function MarketDetailPage({ params }: { params: Promise<{ conditionId: string }> }) {
  const { conditionId } = use(params);
  const { data, loading, error, reload } = useFetch<MarketData>(`/api/markets/${conditionId}`);

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>;
  if (error) return <ErrorState onRetry={reload} />;
  if (!data || !data.groups?.length) return <div className="py-32 text-center text-gray-500">Market not found or no data.</div>;

  const timelineByOutcome = new Map<string, { date: string; holderCount: number; consensusScore: number; totalCurrentValue: number }[]>();
  for (const t of data.timeline) {
    if (!timelineByOutcome.has(t.outcome)) timelineByOutcome.set(t.outcome, []);
    const run = data.runs.find((r) => r.id === t.refreshRunId);
    timelineByOutcome.get(t.outcome)!.push({
      date: run?.completedAt ? new Date(run.completedAt).toLocaleDateString() : new Date(t.createdAt).toLocaleDateString(),
      holderCount: t.holderCount,
      consensusScore: t.consensusScore,
      totalCurrentValue: t.totalCurrentValue,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold break-all">{data.positions[0] ? data.groups[0]?.marketTitle ?? conditionId : conditionId}</h1>
        <p className="text-gray-500 text-sm mt-1">Condition ID: {conditionId}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {data.groups.map((g) => (
          <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase">{g.outcome}</p>
            <p className="text-xl font-bold mt-1">{g.holderCount} whales</p>
            <p className="text-green-400 text-sm">{formatUSD(g.totalCurrentValue)}</p>
            <p className="text-blue-300 text-xs mt-1">Consensus: {g.consensusScore}</p>
          </div>
        ))}
      </div>

      {data.timeline.length > 1 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Holder Count Over Time</h2>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.timeline.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="createdAt" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                <Line type="monotone" dataKey="holderCount" stroke="#60A5FA" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Whale Holders ({data.positions.length})</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["Trader","Wallet","Outcome","Current Value","Size","Cash PnL","Volume"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.positions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <a href={`/traders/${p.proxyWallet}`} className="text-blue-300 hover:underline">{p.username || "Unknown"}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.proxyWallet.slice(0, 10)}...</td>
                  <td className="px-4 py-3 text-gray-300">{p.outcome}</td>
                  <td className="px-4 py-3 text-green-400">{formatUSD(p.currentValue)}</td>
                  <td className="px-4 py-3 text-gray-300">{p.size.toFixed(2)}</td>
                  <td className={`px-4 py-3 ${p.cashPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatUSD(p.cashPnl)}</td>
                  <td className="px-4 py-3 text-gray-400">{p.volume > 0 ? formatUSD(p.volume) : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.positions.length === 0 && <div className="py-12 text-center text-gray-500">No positions found.</div>}
        </div>
      </section>
    </div>
  );
}
