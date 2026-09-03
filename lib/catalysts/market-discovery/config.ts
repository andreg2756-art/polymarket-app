// All market-discovery weights/thresholds/calibration constants in one
// place — spec Part 35/36: "do not scatter constants throughout the
// project." Every other module in this directory imports from here rather
// than hard-coding a number inline.

export const MARKET_IMPORTANCE_WEIGHTS = {
  economicMateriality: 0.30,
  marketQuality: 0.20,
  exposureBreadth: 0.15,
  transmissionClarity: 0.15,
  resolutionQuality: 0.10,
  timeRelevance: 0.10,
};

export const MARKET_IMPORTANCE_THRESHOLDS = {
  core: 80,
  important: 65,
  conditional: 50,
  watch: 35,
};

export const CONDITIONAL_STOCK_RULE = {
  minimumExposureStrength: 0.75,
  minimumRelationshipConfidence: 0.75,
};

export const MARKET_QUALITY_WEIGHTS = {
  liquidity: 0.40,
  volume: 0.35,
  spread: 0.15,
  recentActivity: 0.10,
};

// Log-normalization ceilings (spec Part 9's normalizeLogValue) — calibrated
// against Polymarket's actual observed range: the single biggest active
// markets (Fed decision, presidential election) run ~$1-5M liquidity and
// ~$10-90M cumulative volume, so log10(value+1)/maxLog10 = 1.0 around
// there rather than requiring an unrealistic ceiling that would compress
// every real market toward the low end.
export const MARKET_QUALITY_LOG_CALIBRATION = {
  liquidityMaxLog10: 6.5, // ~$3.2M liquidity reaches 1.0
  volumeMaxLog10: 7.5, // ~$31M 24h volume reaches 1.0 (only the very largest days hit this)
};

// Spread on Polymarket is typically 0.001-0.02 for liquid markets and can
// exceed 0.10 for thin ones — this ceiling is where SpreadScore bottoms
// out at 0, not where it's "bad."
export const MAX_MEANINGFUL_SPREAD = 0.15;

export const MARKET_IMPORTANCE_FORMULA_VERSION_ID = "MARKET_IMPORTANCE_V1";

// Same continuous-decay shape as lib/catalysts/time-weight.ts's
// calculateTimeWeight (reused directly, not duplicated) — kept here only
// as a documented pointer so the two don't silently drift apart if one
// changes without the other being noticed.
export const TIME_RELEVANCE_DECAY_DAYS = 240;
export const TIME_RELEVANCE_FLOOR = 0.25;
