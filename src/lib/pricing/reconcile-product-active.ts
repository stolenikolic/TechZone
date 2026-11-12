import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets `products.is_active` from linked `supplier_products`: true if any linked row is active,
 * false if there is at least one linked row and none are active. Products with no linked rows unchanged.
 *
 * Pass `productIds` to scope the UPDATE to only those masters (e.g. the ones a price-sync job
 * just touched) instead of scanning/locking the whole `products` table — the 2h/4h supplier
 * syncs used to call this unscoped and regularly hit `statement timeout` (PostgREST 8s cap,
 * 2min elsewhere) doing a full ~56k-row UPDATE. Omit it (or pass `undefined`) for the full-catalog
 * behaviour used by the nightly `aggregate_prices` job and admin tools.
 */
export async function reconcileProductsIsActiveFromSupplierOffers(
  supabase: SupabaseClient,
  productIds?: string[]
): Promise<{ error?: string }> {
  if (productIds && productIds.length === 0) return {};

  const { error } = await supabase.rpc(
    "reconcile_products_is_active_from_supplier_offers",
    productIds ? { p_product_ids: productIds } : undefined
  );
  if (error) return { error: error.message };
  return {};
}
