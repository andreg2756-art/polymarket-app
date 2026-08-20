"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUSD } from "@/lib/analytics";
import { TableSkeleton } from "@/components/Skeleton";

interface WhaleMove {
  proxyWallet: string;
  username: string | null;
  conditionId: string;
  marketTitle: string;
  outcome: string;
  prevSize: number;
  nextSize: number;
  sizeDelta: number;
  prevValue: number;
  nextValue: number;
  valueDelta: number;
}

interface NewlyCrowdedMarket {
  conditionId: string;
  marketTitle: string;
  outcome: string;
  category: string | null;
  prevHolderCount: number;
  holderCount: number;
}

interface SignalsResponse {
  noData: boolean;
  message?: string;
  latestRunAt?: string;
  prevRunAt?: string;
  whaleMoves: WhaleMove[];
  newlyCrowded: NewlyCrowdedMarket[];
}

export default function SignalsPage() {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Signals</h1>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : data?.noData ? (
        <div className="rounded-xl border border-gray-800 py-16 text-center text-gray-500">
          {data.message ?? "Not enough data yet."}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">🐋 Big Position Moves</h2>
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                  <tr>
                    {["Trader", "Market", "Outcome", "Size Δ", "Value Δ"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data?.whaleMoves.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <Link href={`/traders/${m.proxyWallet}`} className="text-blue-300 hover:underline">
                          {m.username || "Unknown"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-[280px] truncate">
                        <Link href={`/markets/${m.conditionId}`} className="hover:underline" title={m.marketTitle}>
                          {m.marketTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{m.outcome}</td>
                      <td className={`px-4 py-3 font-medium ${m.sizeDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {m.sizeDelta >= 0 ? "+" : ""}{m.sizeDelta.toFixed(0)}
                      </td>
                      <td className={`px-4 py-3 font-medium ${m.valueDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {m.valueDelta >= 0 ? "+" : ""}{formatUSD(m.valueDelta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.whaleMoves.length === 0 && (
                <div className="py-16 text-center text-gray-500">No large position moves since the last refresh.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">🔥 Newly Crowded Markets</h2>
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                  <tr>
                    {["Market", "Outcome", "Category", "Prev Holders", "Holders"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data?.newlyCrowded.map((c) => (
                    <tr key={`${c.conditionId}-${c.outcome}`} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3 max-w-[320px] truncate">
                        <Link href={`/markets/${c.conditionId}`} className="text-blue-300 hover:underline" title={c.marketTitle}>
                          {c.marketTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{c.outcome}</td>
                      <td className="px-4 py-3 text-gray-500">{c.category ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{c.prevHolderCount}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{c.holderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.newlyCrowded.length === 0 && (
                <div className="py-16 text-center text-gray-500">No newly crowded markets since the last refresh.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
