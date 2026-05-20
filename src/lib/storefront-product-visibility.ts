/**
 * Storefront visibility: supplier-driven active AND not manually hidden.
 * Do not use on admin/import/reconcile queries — those should keep using is_active only.
 */
// Supabase filter builders recurse deeply; a narrow generic breaks tsc on some call sites.
export function applyStorefrontProductVisibility<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase PostgrestFilterBuilder
  const q = query as any;
  return q.eq("is_active", true).eq("publish_locked", false) as T;
}

/** Whether a product row should appear on the shop (e.g. after in-memory fetch). */
export function isStorefrontVisibleProduct(row: {
  is_active?: boolean | null;
  publish_locked?: boolean | null;
}): boolean {
  return Boolean(row.is_active) && !row.publish_locked;
}
