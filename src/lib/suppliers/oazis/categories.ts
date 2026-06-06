/**
 * Hardcoded fallback when `supplier_categories` has no rows for Oázis.
 * Production imports read categories from DB (admin supplier UI).
 */
export type OazisCategory = {
  /** Stable key stored in raw_json.category (stale deactivation). */
  categoryKey: string;
  url: string;
  /** Fallback only — DB `supplier_categories` is authoritative. */
  internalCategoryId?: string;
};

export const OAZIS_CATEGORIES: OazisCategory[] = [
  {
    categoryKey: "procesori",
    url: "https://oaziscomputer.hu/kategoria/27/processzor",
    internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15"
  }
];
