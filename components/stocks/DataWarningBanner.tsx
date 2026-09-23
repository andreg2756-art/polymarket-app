interface DataWarningBannerProps {
  incompleteCount: number;
  totalCount: number;
  description?: string;
  label: string; // e.g. "fundamentals (net income, debt, cash, FCF)" or "earnings data"
}

export default function DataWarningBanner({ incompleteCount, totalCount, label, description }: DataWarningBannerProps) {
  if (totalCount === 0 || incompleteCount === 0) return null;
  const pct = Math.round((incompleteCount / totalCount) * 100);
  const severe = pct >= 50;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
        severe ? "bg-red-950/40 border-red-800 text-red-200" : "bg-yellow-950/30 border-yellow-800 text-yellow-200"
      }`}
    >
      <span className="text-base leading-none">{severe ? "⚠" : "ⓘ"}</span>
      <div>
        <p className="font-medium">
          {label} incomplete or unverified for {incompleteCount} of {totalCount} stocks shown ({pct}%)
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {description ?? "Some required inputs are missing, stale, or lack a verified reporting period. Partial scores use only available inputs. Data collection runs separately from market scans; coverage varies by source."}
        </p>
      </div>
    </div>
  );
}
