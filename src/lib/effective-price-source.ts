import { toNumberOrNull } from "lib/effective-price";

/** Display label for the supplier (or manual) that drives the storefront effective price. */
export function resolveEffectivePriceSource(
  customPrice: unknown,
  basePrice: unknown,
  engineSupplierName: string | null | undefined
): string | null {
  if (toNumberOrNull(customPrice) != null) return "manual";
  const name = engineSupplierName?.trim();
  if (name && name.length > 0) return name;
  const base = toNumberOrNull(basePrice);
  if (base == null || base <= 0) return null;
  return null;
}

export function formatEffectivePriceSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return source;
}
