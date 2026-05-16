/** Stored when an attribute does not apply to a product (e.g. PCIe gen on SATA SSD). */
export const NOT_APPLICABLE_ATTRIBUTE_VALUE = "-" as const;

const NOT_APPLICABLE_NORMALIZED = new Set(["-", "n/a", "—"]);

/**
 * True when a product_attributes / JSON value means "not applicable" — hide on shop, count as filled in admin.
 */
export function isNotApplicableAttributeValue(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (trimmed === "—") return true;
  return NOT_APPLICABLE_NORMALIZED.has(trimmed.toLowerCase());
}

/** Connection contains SATA → PCIe generation does not apply. */
export function isConnectionSATA(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toUpperCase().includes("SATA");
}

/** Drop N/A rows before shop specifications / filter option lists. */
export function filterApplicableSpecificationRows<T extends { value: string }>(rows: T[]): T[] {
  return rows.filter((row) => !isNotApplicableAttributeValue(row.value));
}
