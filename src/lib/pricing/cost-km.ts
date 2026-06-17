import { convertToDisplayCurrency } from "./convert";
import type { PricingSettingsResolved, SupplierPricingRow } from "./types";
import { round2 } from "./sell-price";

/**
 * Acquisition cost in KM for one supplier offer row.
 * Uses `suppliers.pricing_formula` + `pricing_settings` for HUF and domestic KM net; falls back to `convertToDisplayCurrency` when formula is null or currency is not HUF.
 */
export function computeAcquisitionKm(
  priceAmount: number,
  currency: string,
  supplier: SupplierPricingRow | null | undefined,
  settings: PricingSettingsResolved
): number {
  if (!Number.isFinite(priceAmount) || priceAmount < 0) return 0;

  const cur = currency?.trim().toUpperCase() || "";
  const formula = supplier?.pricing_formula ?? null;
  const adj = supplier?.cost_adjustment_multiplier != null && supplier.cost_adjustment_multiplier > 0
    ? supplier.cost_adjustment_multiplier
    : 1;

  if (cur === "HUF" && formula === "ipon_huf") {
    const km = (priceAmount / settings.kurs_eur) * settings.eur_km_rate * settings.pdv_bih;
    return round2(km * adj);
  }

  if (cur === "HUF" && formula === "hungary_huf_alza_tax") {
    const km =
      (priceAmount / settings.kurs_eur) * settings.eur_km_rate * settings.alza_tax * settings.pdv_bih;
    return round2(km * adj);
  }

  if (cur === "HUF" && formula === "domestic_custom") {
    return round2(convertToDisplayCurrency(priceAmount, "HUF") * adj);
  }

  if ((cur === "KM" || cur === "BAM") && formula === "domestic_km_net") {
    return round2(priceAmount * settings.pdv_bih * adj);
  }

  return round2(convertToDisplayCurrency(priceAmount, currency, supplier?.id) * adj);
}
