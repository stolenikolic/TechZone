import type { SupabaseClient } from "@supabase/supabase-js";

export type ReconcileProductsActiveResult = {
  /** Masters whose is_active actually changed. */
  updated?: number;
  error?: string;
};

/**
 * Sets `products.is_active` from linked `supplier_products`: true if any linked row is active,
 * false if there is at least one linked row and none are active. Products with no linked rows unchanged.
 *
 * Pass `productIds` to limit the update to those masters. Omit it to repair every drifted row in the
 * catalog (only rows that disagree are written).
 */
export async function reconcileProductsIsActiveFromSupplierOffers(
  supabase: SupabaseClient,
  productIds?: string[]
): Promise<ReconcileProductsActiveResult> {
  if (productIds && productIds.length === 0) return { updated: 0 };

  const { data, error } = await supabase.rpc(
    "reconcile_products_is_active_from_supplier_offers",
    productIds ? { p_product_ids: productIds } : undefined
  );
  if (error) return { error: error.message };
  const updated = typeof data === "number" ? data : undefined;
  return { updated };
}

/**
 * Catalog drift repair. Throws when the RPC fails so the supplier job exits non-zero
 * instead of leaving `products.is_active` stale.
 */
export async function repairProductsActiveDrift(supabase: SupabaseClient): Promise<number> {
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    throw new Error(`reconcile_products_is_active_from_supplier_offers: ${rec.error}`);
  }
  const updated = rec.updated ?? 0;
  if (updated > 0) {
    console.log(`[reconcile] products.is_active updated: ${updated}`);
  }
  return updated;
}
