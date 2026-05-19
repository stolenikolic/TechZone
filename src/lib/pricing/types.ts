/** Single row from `pricing_settings` (nullable until admin fills). */
export type PricingSettingsRow = {
  id?: string;
  kurs_eur: number | null;
  eur_km_rate: number | null;
  alza_tax: number | null;
  pdv_bih: number | null;
  default_selling_margin: number | null;
  min_absolute_profit_km: number | null;
  min_margin_percent: number | null;
  high_cost_threshold_km: number | null;
  high_cost_max_margin_multiplier: number | null;
  original_price_markup_percent: number | null;
};

/** Resolved numeric settings used in formulas (no nulls for required fields). */
export type PricingSettingsResolved = {
  kurs_eur: number;
  eur_km_rate: number;
  alza_tax: number;
  pdv_bih: number;
  default_selling_margin: number;
  min_absolute_profit_km: number;
  min_margin_percent: number;
  high_cost_threshold_km: number | null;
  high_cost_max_margin_multiplier: number | null;
  /** Percent above effective price for original_price (e.g. 10 = +10%). */
  original_price_markup_percent: number;
};

export type PricingMarginTierRow = {
  id?: string;
  min_cost_km: number;
  max_cost_km: number | null;
  margin_multiplier: number;
  sort_order: number;
};

export type SupplierPricingRow = {
  id: string;
  pricing_formula: string | null;
  cost_adjustment_multiplier: number | null;
};
