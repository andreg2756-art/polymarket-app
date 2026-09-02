"use client";
import StatCard from "@/components/StatCard";
import RefreshButton from "@/components/RefreshButton";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { useFetch } from "@/lib/useFetch";
import { formatUSD } from "@/lib/analytics";
import Link from "next/link";

interface DashboardData {
  noData?: boolean;
  latestRun?: {
    id: string;
    completedAt: string | null;
    topTraderCount: number;
    totalPositions: number;
    failedUsers: number;
  };
  runs?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    topTraderCount: number;
    totalPositions: number;
    failedUsers: number;
  }[];
  topMarkets?: {
    id: string;
    conditionId: string;
    marketTitle: string;
    outcome: string;
    holderCount: number;
    totalCurrentValue: number;
    consensusScore: number;
  }[];
  totalMarkets?: number;
  mostCrowded?: { marketTitle: string; outcome: string; holderCount: number } | null;
  highestConsensus?: { marketTitle: string; outcome: string; consensusScore: number } | null;
  totalCapital?: number;
  changes?: {
    id: string;
    conditionId: string;
    marketTitle: string;
    outcome: string;
    holderCountDelta: number;
    currentValueDelta: number;
    totalCurrentValue: number;
  }[];
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useFetch<DashboardData>("/api/dashboard");

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );

  if (error) return <ErrorState onRetry={reload} />;

  if (!data || data.noData) return (
    <div className="text-center py-32 space-y-4">
      <p className="text-gray-400 text-lg">No data yet. Fetch the latest whale data to get started.</p>
      <RefreshButton onRefresh={reload} />
    </div>
  );

  const { latestRun, topMarkets = [], totalMarkets = 0, mostCrowded, highestConsensus, totalCapital = 0, changes = [], runs = [] } = data;
  const gains = [...changes].filter((c) => c.holderCountDelta > 0).sort((a, b) => b.holderCountDelta - a.holderCountDelta).slice(0, 5);
  const losses = [...changes].filter((c) => c.holderCountDelta < 0).sort((a, b) => a.holderCountDelta - b.holderCountDelta).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Polymarket Whale Tracker</h1>
          {latestRun?.completedAt && (
            <p className="text-gray-500 text-sm mt-1">Last updated: {new Date(latestRun.completedAt).toLocaleString()}</p>
          )}
        </div>
        <RefreshButton onRefresh={reload} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Traders Scanned" value={latestRun?.topTraderCount ?? 0} />
        <StatCard title="Positions Tracked" value={latestRun?.totalPositions ?? 0} />
        <StatCard title="Active Markets" value={totalMarkets} />
        <StatCard title="Failed Requests" value={latestRun?.failedUsers ?? 0} />
        <StatCard title="Whale Capital" value={formatUSD(totalCapital)} accent />
        <StatCard title="Most Crowded" value={mostCrowded ? `${mostCrowded.holderCount} holders` : "N/A"} sub={mostCrowded?.marketTitle} />
        <StatCard title="Top Consensus" value={highestConsensus ? `Score ${highestConsensus.consensusScore}` : "N/A"} sub={highestConsensus?.marketTitle} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">Most Crowded Trades</h2>
          <div className="space-y-2">
            {topMarkets.slice(0, 7).map((m) => (
              <Link key={m.id} href={`/markets/${m.conditionId}`} className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.marketTitle}</p>
                  <p className="text-xs text-gray-500">{m.outcome}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded">{m.holderCount} whales</span>
                  <span className="text-xs text-green-400">{formatUSD(m.totalCurrentValue)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Changes Since Last Snapshot</h2>
          <div className="space-y-2">
            {gains.map((c) => (
              <Link key={c.id} href={`/markets/${c.conditionId}`} className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.marketTitle}</p>
                  <p className="text-xs text-gray-500">{c.outcome}</p>
                </div>
                <span className="text-green-400 text-sm font-semibold shrink-0 ml-3">+{c.holderCountDelta} holders</span>
              </Link>
            ))}
            {losses.map((c) => (
              <Link key={c.id} href={`/markets/${c.conditionId}`} className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.marketTitle}</p>
                  <p className="text-xs text-gray-500">{c.outcome}</p>
                </div>
                <span className="text-red-400 text-sm font-semibold shrink-0 ml-3">{c.holderCountDelta} holders</span>
              </Link>
            ))}
            {gains.length === 0 && losses.length === 0 && (
              <p className="text-gray-600 text-sm py-4">No changes yet. Refresh again after some time.</p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Refresh Runs</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["Started","Status","Traders","Positions","Failed","Duration"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {runs.map((r) => {
                const dur = r.completedAt ? Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000) : null;
                return (
                  <tr key={r.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-gray-400">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "completed" ? "bg-green-900 text-green-300" : r.status === "running" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.topTraderCount}</td>
                    <td className="px-4 py-3 text-gray-300">{r.totalPositions}</td>
                    <td className="px-4 py-3 text-red-400">{r.failedUsers}</td>
                    <td className="px-4 py-3 text-gray-500">{dur != null ? `${dur}s` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
