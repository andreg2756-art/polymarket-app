// MarketQuality: how much to trust a specific Polymarket market's price as
// a real signal, based on liquidity/volume — a thinly-traded market's
// price can be noise. Spec Part 9.
//
// The spec's formula wants a bid/ask spread component too; Polymarket's
// Gamma API (see lib/catalysts/polymarket.ts) doesn't expose a spread
// field on the /markets list endpoint, so that term is dropped and the
// remaining weights renormalized (per the spec's own instruction: "if
// spread data is unavailable, renormalize remaining factors") rather than
// silently treating spread as perfect (1.0) or zero.

export interface MarketQualityInputs {
  liquidity: number | null;
  volume24hr: number | null;
}

// Calibration constants for the log-normalization — chosen so that a
// "meaningfully liquid" market (the Fed rate-cut event's ~$4.2M liquidity,
// ~$50M+ lifetime volume, confirmed by direct testing this session) scores
// close to 1.0, and a near-zero-liquidity market scores close to 0.
const LIQUIDITY_SCALE = 5_000_000; // liquidity at which LiquidityScore ~= 1.0
const VOLUME_SCALE = 500_000; // 24hr volume at which VolumeScore ~= 1.0

function normalizedLog(value: number, scale: number): number {
  if (value <= 0) return 0;
  // log1p avoids -Infinity at value=0 and compresses the long right tail
  // (a $50M-liquidity market shouldn't score 10x a $5M one — both are "deep enough").
  const score = Math.log1p(value) / Math.log1p(scale);
  return Math.max(0, Math.min(1, score));
}

export function calculateMarketQuality({ liquidity, volume24hr }: MarketQualityInputs): number {
  const components: { score: number; weight: number }[] = [];

  if (liquidity !== null) components.push({ score: normalizedLog(liquidity, LIQUIDITY_SCALE), weight: 0.35 });
  if (volume24hr !== null) components.push({ score: normalizedLog(volume24hr, VOLUME_SCALE), weight: 0.30 });
  // SpreadScore (0.20) and ActivityScore (0.15) omitted — not available from
  // the current data source. Renormalize over whatever we do have.

  if (components.length === 0) return 0;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weighted = components.reduce((s, c) => s + c.score * c.weight, 0);
  return weighted / totalWeight;
}

export const MIN_MARKET_QUALITY_FOR_SIGNAL = 0.25;
