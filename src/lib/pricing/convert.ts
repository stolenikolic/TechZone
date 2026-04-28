import { getPricingConfig } from "./config";

/**
 * Supported supplier currency codes for conversion to display currency (KM).
 * HUF and EUR use config rates; KM/BAM pass through.
 */
export type SupplierCurrency = "HUF" | "EUR" | "KM" | "BAM";

/**
 * Converts a supplier price to display currency (KM).
 *
 * - HUF: price_km = (amount / huf_eur_rate) * eur_km_rate * pdv
 * - EUR: price_km = amount * eur_km_rate * pdv
 * - KM / BAM: passthrough (already in display currency)
 * - Other: treated as passthrough (stub for future per-supplier rules)
 *
 * @param amount - Price amount in the given currency
 * @param currency - Currency code (e.g. "HUF", "EUR", "KM")
 * @param _supplierId - Optional; reserved for future per-supplier conversion overrides
 * @returns Amount in KM, rounded to 2 decimal places
 */
export function convertToDisplayCurrency(
  amount: number,
  currency: string,
  _supplierId?: string
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  const normalized = currency?.trim().toUpperCase() || "";

  switch (normalized) {
    case "HUF": {
      const { hufEurRate, eurKmRate, pdv } = getPricingConfig();
      const km = (amount / hufEurRate) * eurKmRate * pdv;
      return roundToTwoDecimals(km);
    }
    case "EUR": {
      const { eurKmRate, pdv } = getPricingConfig();
      const km = amount * eurKmRate * pdv;
      return roundToTwoDecimals(km);
    }
    case "KM":
    case "BAM":
      return roundToTwoDecimals(amount);
    default:
      return roundToTwoDecimals(amount);
  }
}

function roundToTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}
