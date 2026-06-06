/**
 * Hardcoded fallback when `supplier_categories` has no rows for Konzolvilág.
 * Production imports read categories from DB (admin supplier UI).
 */
export type KonzolvilagCategory = {
  /** Stable key stored in raw_json.category (stale deactivation). */
  categoryKey: string;
  url: string;
  /** Fallback only — DB `supplier_categories` is authoritative. */
  internalCategoryId?: string;
};

export const KONZOLVILAG_CATEGORIES: KonzolvilagCategory[] = [
  {
    categoryKey: "procesori",
    url: "https://www.konzolvilag.hu/pc/hardver/processzor",
    internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15"
  }
];
