/**
 * IPON API item shape (from /shop/group/{id}/product/data).
 * Only fields used for master product and supplier_products are typed.
 */
export type IponProductItem = {
  id: string | number;
  displayName: string;
  brand?: string | null;
  description?: string | null;
  grossPrice: number;
  /** Days until supplier can ship; 0 = in stock at iPon. */
  deliveryDays?: number | null;
  delivery_days?: number | null;
  pictures?: string[] | null;
  /** SEO slug from list/detail API — required for canonical product URL */
  slug?: string | null;
  fullName?: string | null;
  productName?: string | null;
  /** Detail page path or absolute URL when present in API payload */
  url?: string | null;
  link?: string | null;
  friendlyUrl?: string | null;
  productUrl?: string | null;
  [key: string]: unknown;
};

const IPON_ORIGIN = "https://iponcomp.com";

/**
 * Resolve product detail URL for JSON-LD / HTML fetch (session cookies recommended).
 * iPon koristi `/shop/product/{slug}/{id}` — samo `/shop/product/{id}` vraća 404.
 */
export function getIponProductDetailUrl(item: IponProductItem): string {
  const candidates = [item.url, item.link, item.friendlyUrl, item.productUrl];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) {
      if (c.startsWith("http")) return c;
      if (c.startsWith("/")) return `${IPON_ORIGIN}${c}`;
    }
  }
  const slug = typeof item.slug === "string" ? item.slug.trim() : "";
  if (slug) {
    return `${IPON_ORIGIN}/shop/product/${slug}/${encodeURIComponent(String(item.id))}`;
  }
  return `${IPON_ORIGIN}/shop/product/${encodeURIComponent(String(item.id))}`;
}

/**
 * Slugify for master product slug. Internal only; do not use IPON slug.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "product";
}

/**
 * Normalize supplier product id to string.
 */
export function toSupplierProductId(item: IponProductItem): string {
  return String(item.id);
}

export function parseIponDeliveryDays(item: IponProductItem): number | null {
  const raw = item.deliveryDays ?? item.delivery_days;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  return null;
}

/** Best-effort warranty months from API payload when present. */
export function parseIponWarrantyMonths(item: IponProductItem): number | null {
  const keys = ["warrantyMonths", "warranty_months", "warranty", "garancia", "garanciaHonap"] as const;
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      const n = Math.round(v);
      return n > 120 ? Math.round(n / 12) : n;
    }
    if (typeof v === "string" && v.trim()) {
      const m = v.match(/(\d+)\s*(?:mjesec|month|honap|m\b)/i) ?? v.match(/^(\d+)$/);
      if (m) return Math.max(1, parseInt(m[1], 10));
    }
  }
  return null;
}
