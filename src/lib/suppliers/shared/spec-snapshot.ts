/**
 * Shared types and helpers for supplier spec snapshots.
 * Used by iPon scrapeDetails and PCX importProducts.
 */

export type SpecRow = { name: string; value: string };

/**
 * Normalized spec snapshot stored in supplier_products.spec_snapshot.
 * factory_link is iPon-only; PCX omits it (null).
 */
export type SpecSnapshot = {
  mpn: string | null;
  ean: string | null;
  factory_link: string | null;
  specs: SpecRow[];
};

function valueToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.value === "number" || typeof o.value === "string") return String(o.value);
    if (typeof o.name === "string") return o.name;
  }
  return "";
}

/**
 * Extracts `additionalProperty` entries from a JSON-LD Product node into SpecRow[].
 */
export function collectAdditionalProperty(node: Record<string, unknown>, acc: SpecRow[]): void {
  const ap = node.additionalProperty;
  if (!ap) return;
  const list = Array.isArray(ap) ? ap : [ap];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const value = valueToString(o.value);
    if (name && value) acc.push({ name, value });
  }
}
