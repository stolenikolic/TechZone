export type PriceSourceRegion = "HU" | "BA" | "custom";

/** Map supplier offer currency to feed region (HU/BA). */
export function currencyToPriceSourceRegion(currency: string): "HU" | "BA" | null {
  const cur = currency?.trim().toUpperCase() || "";
  if (cur === "HUF") return "HU";
  if (cur === "KM" || cur === "BAM") return "BA";
  return null;
}

/**
 * Region for OLX feed: custom override wins; otherwise derive from winning offer currency.
 */
export function resolvePriceSourceRegion(
  customPrice: number | null | undefined,
  winnerCurrency: string | undefined
): PriceSourceRegion | null {
  if (customPrice != null && Number.isFinite(customPrice) && customPrice > 0) {
    return "custom";
  }
  if (!winnerCurrency) return null;
  return currencyToPriceSourceRegion(winnerCurrency);
}
