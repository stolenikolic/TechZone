/**
 * Pricing / currency conversion config for supplier price aggregation.
 * Used to convert supplier prices (e.g. HUF) to display currency (KM).
 *
 * Formula (IPON / HUF): price_km = (price_huf / huf_eur_rate) * eur_km_rate * pdv
 *
 * Env vars (optional; defaults below):
 * - PRICING_HUF_EUR_RATE
 * - PRICING_EUR_KM_RATE
 * - PRICING_PDV
 */

const DEFAULT_HUF_EUR_RATE = 410;
const DEFAULT_EUR_KM_RATE = 1.95;
const DEFAULT_PDV = 1.17;

function parsePositiveNumber(
  value: string | undefined,
  defaultVal: number
): number {
  if (value === undefined || value === "") return defaultVal;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

export type PricingConfig = {
  /** HUF to EUR divisor (e.g. 410 means 410 HUF = 1 EUR). */
  hufEurRate: number;
  /** EUR to KM multiplier (e.g. 1.95). */
  eurKmRate: number;
  /** PDV / VAT multiplier (e.g. 1.17 for 17%). */
  pdv: number;
};

let cached: PricingConfig | null = null;

/**
 * Returns current pricing config from env with defaults.
 * Cached per process; override env vars to change without restart.
 */
export function getPricingConfig(): PricingConfig {
  if (cached) return cached;
  cached = {
    hufEurRate: parsePositiveNumber(
      process.env.PRICING_HUF_EUR_RATE,
      DEFAULT_HUF_EUR_RATE
    ),
    eurKmRate: parsePositiveNumber(
      process.env.PRICING_EUR_KM_RATE,
      DEFAULT_EUR_KM_RATE
    ),
    pdv: parsePositiveNumber(process.env.PRICING_PDV, DEFAULT_PDV)
  };
  return cached;
}

/**
 * Reset cached config (e.g. for tests or after env change).
 */
export function resetPricingConfig(): void {
  cached = null;
}
