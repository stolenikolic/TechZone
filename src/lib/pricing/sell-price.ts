import type { PricingMarginTierRow, PricingSettingsResolved } from "./types";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function integerLastDigitOk(intPart: number): boolean {
  const u = Math.abs(intPart) % 10;
  return u === 0 || u === 5 || u === 9;
}

/**
 * Charm: last digit of integer part must be 0, 5, or 9.
 * If current price already satisfies, keep fractional part (e.g. 35.90 stays 35.90).
 * Otherwise bump integer part up to the next valid integer and use .00 (e.g. 32.90 -> 35.00).
 */
export function charmUnit059(price: number): number {
  const r = round2(price);
  const intPart = Math.floor(r + 1e-9);
  const frac = r - intPart;
  if (integerLastDigitOk(intPart)) return r;
  let n = intPart + 1;
  const cap = intPart + 5000;
  while (n <= cap) {
    if (integerLastDigitOk(n)) return round2(n);
    n += 1;
  }
  return round2(intPart + frac);
}

/** Smallest integer >= `low` whose unit digit is 0, 5, or 9. */
export function nextCharmIntegerGte(low: number): number {
  let n = Math.ceil(low - 1e-9);
  const cap = n + 5000;
  while (n <= cap) {
    if (integerLastDigitOk(n)) return n;
    n += 1;
  }
  return Math.ceil(low);
}

export function applyRoundingPipeline(preSell2: number): number {
  const pre = round2(preSell2);
  // Final rule: remove .90 path completely; always end at .00.
  // Keep nearest-up charm on integer part: unit digit must be 0, 5, or 9.
  const nextInteger = nextCharmIntegerGte(pre);
  return round2(nextInteger);
}

export function pickTierMultiplier(
  costKm: number,
  tiers: PricingMarginTierRow[]
): number | null {
  const sorted = [...tiers].sort((x, y) => {
    if (x.min_cost_km !== y.min_cost_km) return x.min_cost_km - y.min_cost_km;
    return x.sort_order - y.sort_order;
  });
  const c = costKm;
  for (const t of sorted) {
    if (c < t.min_cost_km) continue;
    if (t.max_cost_km != null && c >= t.max_cost_km) continue;
    return t.margin_multiplier;
  }
  return null;
}

/**
 * Resolve selling multiplier m: product override > category default > tier > global default.
 * Override/category replace tier when set (non-null positive).
 */
export function resolveSellingMultiplier(
  costKm: number,
  tiers: PricingMarginTierRow[],
  settings: PricingSettingsResolved,
  categoryMargin: number | null | undefined,
  productMargin: number | null | undefined
): number {
  if (productMargin != null && productMargin > 0) return productMargin;
  if (categoryMargin != null && categoryMargin > 0) return categoryMargin;
  const tier = pickTierMultiplier(costKm, tiers);
  if (tier != null && tier > 0) return tier;
  if (Number.isFinite(settings.default_selling_margin) && settings.default_selling_margin > 0) {
    return settings.default_selling_margin;
  }
  return NaN;
}

export function applyHighCostCapOnMultiplier(
  costKm: number,
  m: number,
  settings: PricingSettingsResolved
): number {
  const thr = settings.high_cost_threshold_km;
  const capM = settings.high_cost_max_margin_multiplier;
  if (thr == null || capM == null) return m;
  if (costKm + 1e-9 < thr) return m;
  return Math.min(m, capM);
}

export function computeSellBeforeRounding(
  costKm: number,
  m: number,
  settings: PricingSettingsResolved
): number {
  const mCapped = applyHighCostCapOnMultiplier(costKm, m, settings);
  const sell0 = round2(costKm * mCapped);
  const minAbs = settings.min_absolute_profit_km;
  const minPct = settings.min_margin_percent;
  const sell1 = round2(Math.max(sell0, costKm + minAbs));
  const sell2 = round2(Math.max(sell1, costKm * (1 + minPct)));
  return sell2;
}

export function computeFinalSellingKm(
  costKm: number,
  m: number,
  settings: PricingSettingsResolved
): number {
  const raw = computeSellBeforeRounding(costKm, m, settings);
  return applyRoundingPipeline(raw);
}
