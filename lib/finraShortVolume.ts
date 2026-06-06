// /lib/finraShortVolume.ts
// FINRA daily short sale volume from their public CDN flat files.
// Free, no API key. NOTE: This is short VOLUME, not short INTEREST.
// Short volume ratio = % of daily volume that was short-side.
// This is NOT the same as exchange-reported short interest (shares held short).

export type FinraShortVolumeResult = {
  shortVolume:       number | null;
  totalVolume:       number | null;
  shortVolumeRatio:  number | null; // percent, e.g. 42.5
  tradeDate:         string | null;
  source:            "finra" | "unavailable";
};

const CDN_BASE = "https://cdn.finra.org/equity/regsho/daily";

function todayAndRecentDates(n = 5): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n + 7; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}${m}${dd}`);
    if (dates.length >= n) break;
  }
  return dates;
}

async function fetchFinraFile(dateStr: string): Promise<string | null> {
  const url = `${CDN_BASE}/CNMSshvol${dateStr}.txt`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 43200 }, // 12 hours — data doesn't change after publish
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseLine(
  line: string,
  symbol: string
): { shortVolume: number; totalVolume: number } | null {
  // Format: Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
  const parts = line.split("|");
  if (parts.length < 5) return null;
  if (parts[1].toUpperCase() !== symbol.toUpperCase()) return null;
  const shortVolume = parseFloat(parts[2]);
  const totalVolume = parseFloat(parts[4]);
  if (!isFinite(shortVolume) || !isFinite(totalVolume) || totalVolume <= 0) return null;
  return { shortVolume, totalVolume };
}

function formatDate(dateStr: string): string {
  // dateStr is YYYYMMDD
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function getFinraShortVolume(symbol: string): Promise<FinraShortVolumeResult> {
  const dates = todayAndRecentDates(5);

  for (const dateStr of dates) {
    const text = await fetchFinraFile(dateStr);
    if (!text) continue;

    const lines = text.split("\n");
    for (const line of lines) {
      const match = parseLine(line, symbol);
      if (match) {
        const ratio = Math.round((match.shortVolume / match.totalVolume) * 1000) / 10;
        return {
          shortVolume:      Math.round(match.shortVolume),
          totalVolume:      Math.round(match.totalVolume),
          shortVolumeRatio: ratio,
          tradeDate:        formatDate(dateStr),
          source:           "finra",
        };
      }
    }
  }

  return {
    shortVolume: null, totalVolume: null,
    shortVolumeRatio: null, tradeDate: null,
    source: "unavailable",
  };
}
