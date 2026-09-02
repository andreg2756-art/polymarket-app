"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const whaleLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/traders", label: "Traders" },
  { href: "/signals", label: "Signals" },
  { href: "/history", label: "History" },
];

const stockLinks = [
  { href: "/stocks/speculative", label: "Speculative" },
  { href: "/stocks/quality", label: "Quality" },
  { href: "/stocks/value", label: "Value" },
  { href: "/stocks/screener", label: "Screener" },
  { href: "/stocks/ideas", label: "Ideas" },
  { href: "/stocks/watchlist", label: "Watchlist" },
];

// Not nested under either group above — it's the bridge between them
// (Polymarket events mapped to stock exposure), not a fit for either.
const catalystsLink = { href: "/catalysts", label: "🔗 Catalysts" };

export default function Nav() {
  const path = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  // /api/stocks/refresh already refreshes Speculative, Quality, and
  // Turnaround together server-side — the trigger lives here instead of on
  // a single tab so it's reachable from any of the three, not just
  // Speculative (where it used to live).
  const onStocksSection = path?.startsWith("/stocks") ?? false;

  async function handleRefresh() {
    setRefreshing(true);
    setMsg("Scanning...");
    try {
      const res = await fetch("/api/stocks/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Each tab only fetches its data once on mount, so there's no way
        // for this button (a Nav sibling, not a parent) to tell the current
        // tab's table to re-fetch — reloading is the simplest way to make
        // whichever tab you're on reflect the new data.
        window.location.reload();
      } else {
        setMsg(`Error: ${data.error}`);
        setRefreshing(false);
      }
    } catch {
      setMsg("Error: refresh failed");
      setRefreshing(false);
    }
  }

  function linkClass(href: string) {
    return `text-sm whitespace-nowrap transition-colors ${path === href ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`;
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="px-4 md:px-6 py-3 flex items-center gap-2">
        <span className="text-blue-400 font-bold text-base tracking-tight whitespace-nowrap">🐋 Whale Tracker</span>

        {/* Desktop nav — unchanged from before, just scoped to md+ */}
        <div className="hidden md:flex items-center gap-2 overflow-x-auto">
          <div className="flex gap-5 ml-2">
            {whaleLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-700 mx-3 shrink-0" />

          <span className="text-emerald-400 font-bold text-base tracking-tight whitespace-nowrap">📈 Stocks</span>
          <div className="flex gap-5 ml-2">
            {stockLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-700 mx-3 shrink-0" />
          <Link href={catalystsLink.href} className={linkClass(catalystsLink.href)}>{catalystsLink.label}</Link>
        </div>

        {onStocksSection && (
          <div className="hidden md:flex items-center gap-2 ml-auto pl-3">
            {msg && <span className="text-xs text-gray-500 whitespace-nowrap">{msg}</span>}
            <button onClick={handleRefresh} disabled={refreshing}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
              {refreshing ? "Scanning..." : "Scan Market"}
            </button>
          </div>
        )}

        {/* Mobile hamburger toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          className="md:hidden ml-auto p-2 -mr-2 text-gray-300 hover:text-white"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 px-4 py-4 space-y-5">
          <div>
            <p className="text-blue-400 font-bold text-xs uppercase tracking-wider mb-2">🐋 Whale Tracker</p>
            <div className="flex flex-col gap-3">
              {whaleLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">📈 Stocks</p>
            <div className="flex flex-col gap-3">
              {stockLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <Link href={catalystsLink.href} onClick={() => setMobileOpen(false)} className={linkClass(catalystsLink.href)}>
              {catalystsLink.label}
            </Link>
          </div>

          {onStocksSection && (
            <div className="pt-1 space-y-2">
              {msg && <p className="text-xs text-gray-500">{msg}</p>}
              <button onClick={handleRefresh} disabled={refreshing}
                className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                {refreshing ? "Scanning..." : "Scan Market"}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
