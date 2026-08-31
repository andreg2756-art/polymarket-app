interface DataWarningBannerProps {
  incompleteCount: number;
  totalCount: number;
  label: string; // e.g. "fundamentals (net income, debt, cash, FCF)" or "earnings data"
}

// FMP's current plan rejects (HTTP 402) financial-statement/float requests
// for anything outside a small mega-cap allowlist — confirmed by testing
// directly (AAPL succeeds, most small/mid caps don't). Those calls fail
// silently server-side (Promise.allSettled + null fallback), so this makes
// the resulting data gaps visible in the UI instead of only in email alerts
// and Vercel logs.
export default function DataWarningBanner({ incompleteCount, totalCount, label }: DataWarningBannerProps) {
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
          {label} unavailable for {incompleteCount} of {totalCount} stocks shown ({pct}%)
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          Likely an FMP plan restriction — financial-statement and float data currently only return for a small
          set of mega-cap symbols, not the small/mid-caps this screener targets. Affected rows are scored on
          price/valuation data alone, not the full formula.
        </p>
      </div>
    </div>
  );
}
