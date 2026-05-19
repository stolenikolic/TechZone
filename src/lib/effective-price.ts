export function toNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value);
}

export function getEffectivePrice(customPrice: unknown, basePrice: unknown): number {
  const custom = toNumberOrNull(customPrice);
  if (custom != null) return custom;
  const base = toNumberOrNull(basePrice);
  return base ?? 0;
}

export function getOriginalPriceForDisplay(
  originalPrice: unknown,
  effectivePrice: number
): number | undefined {
  const original = toNumberOrNull(originalPrice);
  if (original == null) return undefined;
  return original > effectivePrice ? original : undefined;
}

export type ProductPriceFields = {
  price: number;
  originalPrice?: number;
};

/** Map DB price columns to storefront effective + optional strikethrough original. */
export function mapProductPriceFields(row: {
  price?: unknown;
  custom_price?: unknown;
  original_price?: unknown;
}): ProductPriceFields {
  const price = getEffectivePrice(row.custom_price, row.price);
  const originalPrice = getOriginalPriceForDisplay(row.original_price, price);
  return {
    price,
    ...(originalPrice != null && { originalPrice })
  };
}
