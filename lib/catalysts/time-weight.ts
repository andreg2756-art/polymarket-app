// TimeWeight: near-term resolutions matter more for catalyst ranking than
// distant ones. Spec Part 11 — continuous formula, per the spec's stated
// preference over the discrete-bucket alternative.

const DECAY_CONSTANT_DAYS = 240;
const MIN_TIME_WEIGHT = 0.25;
const MAX_TIME_WEIGHT = 1.0;

export function calculateTimeWeight(daysToResolution: number): number {
  const raw = Math.exp(-Math.max(0, daysToResolution) / DECAY_CONSTANT_DAYS);
  return Math.max(MIN_TIME_WEIGHT, Math.min(MAX_TIME_WEIGHT, raw));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return (to - from) / 86_400_000;
}
