import type { SupabaseClient } from "@supabase/supabase-js";
import { getEffectivePrice } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";

export type ShopProductRow = {
  id: string;
  brand: string | null;
  price: number | null;
  custom_price: number | null;
  is_active: boolean;
  publish_locked?: boolean;
};

/** Master proizvod vidljiv u shopu: aktivan, nije ručno sakriven, ima konačnu cijenu > 0. */
export function isShopVisibleProduct(row: ShopProductRow): boolean {
  if (!row.is_active || row.publish_locked) return false;
  const effective = getEffectivePrice(row.custom_price, row.price);
  return Number.isFinite(effective) && effective > 0;
}

/**
 * Aktivni master proizvodi u kategoriji koji se smiju prikazati u shop listi / filterima.
 */
export async function fetchShopVisibleProductsForCategory(
  supabase: SupabaseClient,
  categoryId: string
): Promise<ShopProductRow[]> {
  const { data, error } = await applyStorefrontProductVisibility(
    supabase
      .from("products")
      .select("id, brand, price, custom_price, is_active, publish_locked")
      .eq("category_id", categoryId)
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as ShopProductRow[]).filter(isShopVisibleProduct);
}

export function shopVisibleProductIds(rows: ShopProductRow[]): string[] {
  return rows.map((r) => r.id);
}
