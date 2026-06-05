"use client";
import { useState } from "react";

interface Props {
  onRefresh?: () => void;
}

export default function RefreshButton({ onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleRefresh() {
    setLoading(true);
    setMsg("Fetching data...");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMsg(`Done — ${data.run.totalPositions} positions from ${data.run.topTraderCount} traders`);
        onRefresh?.();
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Refreshing..." : "Refresh Data"}
      </button>
      {msg && <span className="text-sm text-gray-400">{msg}</span>}
    </div>
  );
}
