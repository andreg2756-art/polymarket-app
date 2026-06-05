"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/traders", label: "Traders" },
  { href: "/history", label: "History" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center gap-8">
      <span className="text-blue-400 font-bold text-lg tracking-tight">🐋 Whale Tracker</span>
      <div className="flex gap-6">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm transition-colors ${path === l.href ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
