import { parseNumericFromAttributeValue } from "lib/shop/range-filter-utils";

export type AttributeFilterMeta = {
  filterDisplayType: string | null;
  filterUnit: string | null;
};

/**
 * For range attributes with filter_unit: extract the first number and format as "{n} {unit}".
 * Example: "5pcs" + unit "kom" → "5 kom"
 */
export function normalizeRangeUnitValue(
  rawValue: string,
  meta: AttributeFilterMeta | null | undefined
): string | null {
  const unit = meta?.filterUnit?.trim();
  if (!unit || meta?.filterDisplayType !== "range") return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const numeric = parseNumericFromAttributeValue(trimmed);
  if (numeric == null || !Number.isFinite(numeric)) return null;

  const numberText = Number.isInteger(numeric) ? String(Math.trunc(numeric)) : String(numeric);
  return `${numberText} ${unit}`;
}
