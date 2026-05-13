import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets `products.is_active` from linked `supplier_products`: true if any linked row is active,
 * false if there is at least one linked row and none are active. Products with no linked rows unchanged.
 */
export async function reconcileProductsIsActiveFromSupplierOffers(
  supabase: SupabaseClient
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("reconcile_products_is_active_from_supplier_offers");
  if (error) return { error: error.message };
  return {};
}
