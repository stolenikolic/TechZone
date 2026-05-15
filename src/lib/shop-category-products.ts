import type { SupabaseClient } from "@supabase/supabase-js";
import { getEffectivePrice } from "lib/effective-price";

export type ShopProductRow = {
  id: string;
  brand: string | null;
  price: number | null;
  custom_price: number | null;
  is_active: boolean;
};

/** Master proizvod vidljiv u shopu: aktivan i ima konačnu cijenu > 0. */
export function isShopVisibleProduct(row: ShopProductRow): boolean {
  if (!row.is_active) return false;
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
  const { data, error } = await supabase
    .from("products")
    .select("id, brand, price, custom_price, is_active")
    .eq("category_id", categoryId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return ((data ?? []) as ShopProductRow[]).filter(isShopVisibleProduct);
}

export function shopVisibleProductIds(rows: ShopProductRow[]): string[] {
  return rows.map((r) => r.id);
}
