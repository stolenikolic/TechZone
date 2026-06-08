import {
  findMatchingAttributeValueAlias,
  type AttributeValueAliasRow
} from "lib/attributes/attribute-value-alias";
import { isColorAttributeSlug, normalizeColorValue } from "lib/attributes/normalize-color-value";
import {
  normalizeRangeUnitValue,
  type AttributeFilterMeta
} from "lib/attributes/normalize-range-unit-value";

/**
 * Enrichment value resolver:
 * 1. Manual value alias wins when it matches
 * 2. Else color attribute → basic EN/HU token translation (combinations joined with " - ")
 * 3. Else range + filter_unit → "{number} {unit}"
 * 4. Else trimmed raw unchanged
 */
export function resolveEnrichedAttributeValue(
  rawValue: string,
  aliasRows: AttributeValueAliasRow[],
  supplierId: string | null | undefined,
  meta: AttributeFilterMeta | null | undefined,
  attributeSlug?: string | null
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const matchedAlias = findMatchingAttributeValueAlias(trimmed, aliasRows, supplierId);
  if (matchedAlias) return matchedAlias.canonicalLabel.trim();

  if (isColorAttributeSlug(attributeSlug)) {
    const colorNormalized = normalizeColorValue(trimmed);
    if (colorNormalized) return colorNormalized;
  }

  const normalized = normalizeRangeUnitValue(trimmed, meta);
  return normalized ?? trimmed;
}
