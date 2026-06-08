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

/** PostgREST default row cap — paginate to load full category pools. */
const CATEGORY_PRODUCT_PAGE_SIZE = 1000;

/**
 * Aktivni master proizvodi u kategoriji koji se smiju prikazati u shop listi / filterima.
 */
export async function fetchShopVisibleProductsForCategory(
  supabase: SupabaseClient,
  categoryId: string
): Promise<ShopProductRow[]> {
  const rows: ShopProductRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await applyStorefrontProductVisibility(
      supabase
        .from("products")
        .select("id, brand, price, custom_price, is_active, publish_locked")
        .eq("category_id", categoryId)
        .order("id", { ascending: true })
        .range(offset, offset + CATEGORY_PRODUCT_PAGE_SIZE - 1)
    );

    if (error) throw new Error(error.message);

    const batch = (data ?? []) as ShopProductRow[];
    if (batch.length === 0) break;

    rows.push(...batch.filter(isShopVisibleProduct));

    if (batch.length < CATEGORY_PRODUCT_PAGE_SIZE) break;
    offset += CATEGORY_PRODUCT_PAGE_SIZE;
  }

  return rows;
}

export function shopVisibleProductIds(rows: ShopProductRow[]): string[] {
  return rows.map((r) => r.id);
}
