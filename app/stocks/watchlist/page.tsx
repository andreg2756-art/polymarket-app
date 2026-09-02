"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import { exportCSV } from "@/lib/analytics";

interface WatchlistItem {
  id: string;
  ticker: string;
  listName: string;
  targetPrice: number | null;
  targetScore: number | null;
  stock: {
    ticker: string; name: string; price: number; bullishScore: number;
    change1M: number; revenueGrowth: number; analystRating: string | null; marketCap: number;
  };
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { targetPrice: string; targetScore: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/stocks/watchlist");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WatchlistItem[] = await res.json();
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((i) => [
            i.ticker,
            { targetPrice: i.targetPrice?.toString() ?? "", targetScore: i.targetScore?.toString() ?? "" },
          ])
        )
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(ticker: string) {
    try {
      await fetch("/api/stocks/watchlist", { method: "DELETE", body: JSON.stringify({ ticker }), headers: { "Content-Type": "application/json" } });
    } catch {
      return;
    }
    load();
  }

  async function saveTargets(ticker: string) {
    setSaving(ticker);
    const draft = drafts[ticker];
    try {
      await fetch("/api/stocks/watchlist", {
        method: "PATCH",
        body: JSON.stringify({
          ticker,
          targetPrice: draft.targetPrice === "" ? null : Number(draft.targetPrice),
          targetScore: draft.targetScore === "" ? null : Number(draft.targetScore),
        }),
        headers: { "Content-Type": "application/json" },
      });
      load();
    } catch {
      // leave the row unchanged; the user can retry the save
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-400">Watchlist</h1>
        <button onClick={() => exportCSV(items.map((i) => ({ ...i.stock })) as unknown as Record<string, unknown>[], "watchlist.csv")} className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1 rounded">
          Export CSV
        </button>
      </div>

      {loading ? <Skeleton className="h-48" /> : error ? <ErrorState onRetry={load} /> : items.length === 0 ? (
        <div className="py-24 text-center space-y-2">
          <p className="text-gray-400">Your watchlist is empty.</p>
          <p className="text-gray-600 text-sm">Visit any stock page and click <strong>Add to Watchlist</strong>.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>{["Ticker","Company","Price","1M","Rev Growth","Rating","Score","Alert Price","Alert Score",""].map((h) => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3"><Link href={`/stocks/${item.ticker}`} className="text-emerald-400 font-bold hover:underline">{item.ticker}</Link></td>
                  <td className="px-4 py-3 text-gray-200 max-w-[200px] truncate">{item.stock.name}</td>
                  <td className="px-4 py-3 text-white">${item.stock.price.toFixed(2)}</td>
                  <td className={`px-4 py-3 ${item.stock.change1M >= 0 ? "text-emerald-400" : "text-red-400"}`}>{item.stock.change1M >= 0 ? "+" : ""}{item.stock.change1M.toFixed(1)}%</td>
                  <td className={`px-4 py-3 ${item.stock.revenueGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{item.stock.revenueGrowth >= 0 ? "+" : ""}{item.stock.revenueGrowth.toFixed(1)}%</td>
                  <td className={`px-4 py-3 text-xs ${item.stock.analystRating?.includes("Buy") ? "text-emerald-400" : "text-gray-400"}`}>{item.stock.analystRating || "N/A"}</td>
                  <td className="px-4 py-3"><span className="bg-emerald-900 text-emerald-300 text-xs px-2 py-0.5 rounded-full">{item.stock.bullishScore}</span></td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={drafts[item.ticker]?.targetPrice ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [item.ticker]: { ...d[item.ticker], targetPrice: e.target.value } }))}
                      placeholder="—"
                      className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={drafts[item.ticker]?.targetScore ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [item.ticker]: { ...d[item.ticker], targetScore: e.target.value } }))}
                      placeholder="—"
                      className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => saveTargets(item.ticker)}
                      disabled={saving === item.ticker}
                      className="text-xs text-emerald-400 hover:text-emerald-300 mr-3 disabled:opacity-50"
                    >
                      {saving === item.ticker ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => remove(item.ticker)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
