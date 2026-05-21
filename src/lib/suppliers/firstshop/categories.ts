/**
 * Hardcoded fallback when `supplier_categories` has no rows for FirstShop.
 * Production imports read categories from DB (admin supplier UI).
 */
export type FirstshopCategory = {
  /** Stable key stored in raw_json.category (stale deactivation). */
  categoryKey: string;
  url: string;
  /** Fallback only — DB `supplier_categories` is authoritative. */
  internalCategoryId?: string;
};

export const FIRSTSHOP_CATEGORIES: FirstshopCategory[] = [
  {
    categoryKey: "procesori",
    url: "https://firstshop.hu/hardver/processzor-c2",
    internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15"
  }
];
