// delta: positive = moved up (better/lower rank number) since the last
// snapshot day, negative = moved down, 0 = unchanged, null = no prior
// snapshot to compare against (new entrant, or not enough history yet).
export default function RankChangeBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      title={up ? `Up ${delta} spot${delta === 1 ? "" : "s"} since last refresh` : `Down ${Math.abs(delta)} spot${Math.abs(delta) === 1 ? "" : "s"} since last refresh`}
      className={`ml-1 inline-flex items-center text-[10px] font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}
    >
      {up ? "▲" : "▼"}{Math.abs(delta)}
    </span>
  );
}
