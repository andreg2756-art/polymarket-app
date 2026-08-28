"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const whaleLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/traders", label: "Traders" },
  { href: "/signals", label: "Signals" },
  { href: "/history", label: "History" },
];

const stockLinks = [
  { href: "/stocks", label: "Speculative" },
  { href: "/stocks/quality", label: "Quality" },
  { href: "/stocks/value", label: "Value" },
  { href: "/stocks/screener", label: "Screener" },
  { href: "/stocks/ideas", label: "Ideas" },
  { href: "/stocks/watchlist", label: "Watchlist" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center gap-2 overflow-x-auto">
      <span className="text-blue-400 font-bold text-base tracking-tight whitespace-nowrap">🐋 Whale Tracker</span>
      <div className="flex gap-5 ml-2">
        {whaleLinks.map((l) => (
          <Link key={l.href} href={l.href}
            className={`text-sm whitespace-nowrap transition-colors ${path === l.href ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-700 mx-3 shrink-0" />

      <span className="text-emerald-400 font-bold text-base tracking-tight whitespace-nowrap">📈 Stocks</span>
      <div className="flex gap-5 ml-2">
        {stockLinks.map((l) => (
          <Link key={l.href} href={l.href}
            className={`text-sm whitespace-nowrap transition-colors ${path === l.href ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
