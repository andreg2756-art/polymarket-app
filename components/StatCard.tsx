"use client";

interface Props {
  title: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ title, value, sub, accent }: Props) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${accent ? "border-blue-500 bg-blue-950/30" : "border-gray-700 bg-gray-900"}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
    </div>
  );
}
