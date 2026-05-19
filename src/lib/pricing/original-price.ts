import { getEffectivePrice } from "lib/effective-price";

/** Default when pricing_settings.original_price_markup_percent is unset. */
export const DEFAULT_ORIGINAL_PRICE_MARKUP_PERCENT = 10;

/**
 * Reference (strikethrough) price from effective selling price.
 * Formula: effective × (1 + markup%/100), rounded to nearest whole KM (stored as N.00).
 */
export function computeOriginalPriceKm(effectivePrice: number, markupPercent: number): number {
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return 0;

  const pct =
    Number.isFinite(markupPercent) && markupPercent >= 0
      ? markupPercent
      : DEFAULT_ORIGINAL_PRICE_MARKUP_PERCENT;

  const raw = effectivePrice * (1 + pct / 100);
  return Math.round(raw);
}

export function resolveOriginalPriceMarkupPercent(value: number | null | undefined): number {
  if (value != null && Number.isFinite(value) && value >= 0) return value;
  return DEFAULT_ORIGINAL_PRICE_MARKUP_PERCENT;
}

export function computeOriginalPriceFromProductRow(
  row: { price: unknown; custom_price: unknown },
  markupPercent: number
): number {
  const effective = getEffectivePrice(row.custom_price, row.price);
  return computeOriginalPriceKm(effective, markupPercent);
}
