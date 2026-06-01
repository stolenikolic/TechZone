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
 * Match-only: hyphens/dashes treated like spaces (storage still uses {@link normalizeMpn}).
 * e.g. `GV-R76GAMING OC-8GD` matches `GV-R76GAMING-OC-8GD`.
 */
export function normalizeMpnForMatchCompare(raw: string | null | undefined): string | null {
  const base = normalizeMpn(raw);
  if (!base) return null;
  return base
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Persisted on `products` / `supplier_products`; same rules as {@link normalizeMpnForMatchCompare}. */
export const mpnMatchKeyFromMpn = normalizeMpnForMatchCompare;

/**
 * Keep digits only for GTIN/EAN-13; empty → null.
 * Does not validate check digit (caller can add later).
 */
export function normalizeEan(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}

/** GTIN lengths only — used when suppliers put EAN in the MPN field (match step). */
export function eanFromMpnField(raw: string | null | undefined): string | null {
  const digits = normalizeEan(raw);
  if (!digits) return null;
  if (digits.length === 8 || digits.length === 12 || digits.length === 13) return digits;
  return null;
}
