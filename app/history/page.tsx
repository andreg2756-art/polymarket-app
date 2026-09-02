"use client";
import { Skeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import { useFetch } from "@/lib/useFetch";

interface Run {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  topTraderCount: number;
  totalPositions: number;
  failedUsers: number;
  errorMessage: string | null;
}

export default function HistoryPage() {
  const { data, loading, error, reload } = useFetch<Run[]>("/api/runs");
  const runs = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Snapshot History</h1>
      <p className="text-gray-500 text-sm">Each row is a full data refresh. Run "Refresh Data" from the dashboard to create new snapshots.</p>

      {loading ? <Skeleton className="h-64" /> : error ? <ErrorState onRetry={reload} /> : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {["#","Started","Completed","Status","Traders","Positions","Failed","Duration","Error"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {runs.map((r, i) => {
                const dur = r.completedAt
                  ? Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
                  : null;
                return (
                  <tr key={r.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400">{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "completed" ? "bg-green-900 text-green-300" : r.status === "running" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.topTraderCount}</td>
                    <td className="px-4 py-3 text-gray-300">{r.totalPositions}</td>
                    <td className="px-4 py-3 text-red-400">{r.failedUsers}</td>
                    <td className="px-4 py-3 text-gray-500">{dur != null ? `${dur}s` : "—"}</td>
                    <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">{r.errorMessage || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {runs.length === 0 && <div className="py-16 text-center text-gray-500">No refresh runs yet.</div>}
        </div>
      )}
    </div>
  );
}
