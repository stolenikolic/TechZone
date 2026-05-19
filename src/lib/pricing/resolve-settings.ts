import { getPricingConfig } from "./config";
import { resolveOriginalPriceMarkupPercent } from "./original-price";
import type { PricingMarginTierRow, PricingSettingsResolved, PricingSettingsRow } from "./types";

/**
 * Merges DB row with env-based defaults from `getPricingConfig()` only for legacy FX fields
 * (`kurs_eur`, `eur_km_rate`, `pdv_bih`) when DB has NULL. Other business knobs must come from DB.
 */
export function resolvePricingSettingsRow(row: PricingSettingsRow | null): {
  settings: PricingSettingsResolved;
  warnings: string[];
} {
  const env = getPricingConfig();
  const warnings: string[] = [];

  const numFx = (v: number | null | undefined, fallback: number, name: string): number => {
    if (v != null && Number.isFinite(v) && v > 0) return v;
    if (v != null && (!Number.isFinite(v) || v <= 0)) {
      warnings.push(`${name} invalid in DB; using env fallback.`);
    } else {
      warnings.push(`${name} null in DB; using PRICING_* env fallback.`);
    }
    return fallback;
  };

  const kurs_eur = numFx(row?.kurs_eur, env.hufEurRate, "kurs_eur");
  const eur_km_rate = numFx(row?.eur_km_rate, env.eurKmRate, "eur_km_rate");
  const pdv_bih = numFx(row?.pdv_bih, env.pdv, "pdv_bih");

  const alza_tax =
    row?.alza_tax != null && Number.isFinite(row.alza_tax) && row.alza_tax > 0 ? row.alza_tax : NaN;

  const default_selling_margin =
    row?.default_selling_margin != null && Number.isFinite(row.default_selling_margin) && row.default_selling_margin > 0
      ? row.default_selling_margin
      : NaN;

  const min_absolute_profit_km =
    row?.min_absolute_profit_km != null && Number.isFinite(row.min_absolute_profit_km) && row.min_absolute_profit_km >= 0
      ? row.min_absolute_profit_km
      : 0;

  const min_margin_percent =
    row?.min_margin_percent != null && Number.isFinite(row.min_margin_percent) && row.min_margin_percent >= 0
      ? row.min_margin_percent
      : 0;

  const high_cost_threshold_km =
    row?.high_cost_threshold_km != null && Number.isFinite(row.high_cost_threshold_km) && row.high_cost_threshold_km > 0
      ? row.high_cost_threshold_km
      : null;

  const high_cost_max_margin_multiplier =
    row?.high_cost_max_margin_multiplier != null &&
    Number.isFinite(row.high_cost_max_margin_multiplier) &&
    row.high_cost_max_margin_multiplier > 0
      ? row.high_cost_max_margin_multiplier
      : null;

  const original_price_markup_percent = resolveOriginalPriceMarkupPercent(
    row?.original_price_markup_percent
  );

  return {
    settings: {
      kurs_eur,
      eur_km_rate,
      alza_tax,
      pdv_bih,
      default_selling_margin,
      min_absolute_profit_km,
      min_margin_percent,
      high_cost_threshold_km,
      high_cost_max_margin_multiplier,
      original_price_markup_percent
    },
    warnings
  };
}

export function validatePricingForAggregation(
  settings: PricingSettingsResolved,
  tiers: PricingMarginTierRow[],
  needsAlzaTax: boolean
): string | null {
  if (!Number.isFinite(settings.alza_tax) || settings.alza_tax <= 0) {
    if (needsAlzaTax) return "Set pricing_settings.alza_tax in admin (required for hungary_huf_alza_tax suppliers).";
  }
  if (!Number.isFinite(settings.default_selling_margin) || settings.default_selling_margin <= 0) {
    if (!tiers.length) return "Set pricing_settings.default_selling_margin or add pricing_margin_tiers rows.";
  }
  return null;
}
