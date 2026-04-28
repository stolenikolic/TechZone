/**
 * Normalize MPN/EAN for storage and matching (plan: trim; EAN stable string).
 * Call these before INSERT/UPDATE on `products` / `supplier_products`.
 */

/** Trim; collapse internal whitespace; empty → null */
export function normalizeMpn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s+/g, " ");
  return t.length === 0 ? null : t;
}

/**
 * Keep digits only for GTIN/EAN-13; empty → null.
 * Does not validate check digit (caller can add later).
 */
export function normalizeEan(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}
