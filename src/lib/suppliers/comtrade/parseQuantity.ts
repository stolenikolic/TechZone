/**
 * Parsira quantity string iz /Price/items (npr. "20+", "5", "0").
 */
export function parseComtradeQuantity(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const trimmed = String(raw).trim();
  if (!trimmed) return 0;
  const m = trimmed.match(/^(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function isComtradeInStockFromQuantity(raw: string | null | undefined): boolean {
  return parseComtradeQuantity(raw) > 0;
}
