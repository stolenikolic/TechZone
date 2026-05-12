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
