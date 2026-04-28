/**
 * Registry entry: which supplier listing/API category syncs into which internal `categories.id`.
 * Used as code-first config (per-supplier file); optional DB mirror later.
 */
export type SupplierCategorySource = {
  /** Supplier-specific category id (e.g. iPon API numeric category). */
  supplierCategoryId: number;
  /** UUID of `categories.id` in our DB. */
  internalCategoryId: string;
  /** If false, sync runners skip this row. */
  enabled: boolean;
  /** Optional label for logs / docs (not used by sync logic). */
  label?: string;
  /** Human-readable listing URL on supplier site (reference / docs only). */
  listingUrl?: string;
};

export function getEnabledCategorySources(sources: SupplierCategorySource[]): SupplierCategorySource[] {
  return sources.filter((s) => s.enabled);
}
