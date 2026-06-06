/**
 * Hardcoded fallback when `supplier_categories` has no rows for PCLand.
 * Production imports read categories from DB (admin supplier UI).
 */
export type PclandCategory = {
  /** Stable key stored in raw_json.category (stale deactivation). */
  categoryKey: string;
  url: string;
  /** Fallback only — DB `supplier_categories` is authoritative. */
  internalCategoryId?: string;
};

export const PCLAND_CATEGORIES: PclandCategory[] = [
  {
    categoryKey: "procesori",
    url: "https://pcland.hu/termekek-158/szamitogep-alkatresz-160/processzor-397",
    internalCategoryId: "b7acf048-472c-4d15-af63-a9c78883ba15"
  }
];
