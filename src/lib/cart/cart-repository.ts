import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "contexts/CartContext";
import { applyStorefrontProductVisibility, isStorefrontVisibleProduct } from "lib/storefront-product-visibility";
import { mapProductToCartItem } from "./map-cart-item";
import type { CartLineInput, DbCartItemRow, DbCartProductRow } from "./types";

const PRODUCT_SELECT = "id, name, slug, main_image, price, custom_price, is_active, publish_locked";

export function normalizeLineInputs(items: { id?: string; productId?: string; qty?: unknown }[]): CartLineInput[] {
  const byProduct = new Map<string, number>();

  for (const item of items) {
    const productId =
      typeof item.productId === "string"
        ? item.productId.trim()
        : typeof item.id === "string"
          ? item.id.trim()
          : "";
    if (!productId) continue;

    const qtyRaw = typeof item.qty === "number" ? item.qty : Number(item.qty);
    if (!Number.isFinite(qtyRaw)) continue;

    const qty = Math.max(1, Math.floor(qtyRaw));
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + qty);
  }

  return Array.from(byProduct.entries()).map(([productId, qty]) => ({ productId, qty }));
}

async function fetchProductsByIds(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, DbCartProductRow>> {
  if (productIds.length === 0) return new Map();

  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", productIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, DbCartProductRow>();
  for (const row of (data ?? []) as DbCartProductRow[]) {
    map.set(String(row.id), row);
  }
  return map;
}

async function fetchVisibleProducts(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, DbCartProductRow>> {
  if (productIds.length === 0) return new Map();

  const { data, error } = await applyStorefrontProductVisibility(
    supabase.from("products").select(PRODUCT_SELECT).in("id", productIds)
  );

  if (error) throw new Error(error.message);

  const map = new Map<string, DbCartProductRow>();
  for (const row of (data ?? []) as DbCartProductRow[]) {
    if (isStorefrontVisibleProduct(row)) {
      map.set(String(row.id), row);
    }
  }
  return map;
}

export async function getCartForUser(supabase: SupabaseClient, userId: string): Promise<CartItem[]> {
  const { data: cartRows, error: cartError } = await supabase
    .from("cart_items")
    .select("product_id, quantity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (cartError) throw new Error(cartError.message);

  const rows = (cartRows ?? []) as DbCartItemRow[];
  if (rows.length === 0) return [];

  const productIds = rows.map((row) => String(row.product_id));
  const productsById = await fetchProductsByIds(supabase, productIds);

  return rows
    .map((row) => {
      const product = productsById.get(String(row.product_id));
      if (!product) return null;
      return mapProductToCartItem(product, row.quantity);
    })
    .filter((item): item is CartItem => item != null);
}

export async function replaceCartForUser(
  supabase: SupabaseClient,
  userId: string,
  items: { id?: string; productId?: string; qty?: unknown }[]
): Promise<void> {
  const normalized = normalizeLineInputs(items);

  const { error: deleteError } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  if (normalized.length === 0) return;

  const productIds = normalized.map((line) => line.productId);
  const productsById = await fetchVisibleProducts(supabase, productIds);
  const validLines = normalized.filter((line) => productsById.has(line.productId));

  if (validLines.length === 0) return;

  const now = new Date().toISOString();
  const insertRows = validLines.map((line) => ({
    user_id: userId,
    product_id: line.productId,
    quantity: line.qty,
    updated_at: now
  }));

  const { error: insertError } = await supabase.from("cart_items").insert(insertRows);
  if (insertError) throw new Error(insertError.message);
}

export async function mergeGuestCart(
  supabase: SupabaseClient,
  userId: string,
  guestItems: { id?: string; productId?: string; qty?: unknown }[]
): Promise<void> {
  const guestLines = normalizeLineInputs(guestItems);
  if (guestLines.length === 0) return;

  const { data: allServerRows, error: allError } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("user_id", userId);

  if (allError) throw new Error(allError.message);

  const mergedByProduct = new Map<string, number>();

  for (const row of allServerRows ?? []) {
    mergedByProduct.set(String(row.product_id), Math.max(1, Math.floor(Number(row.quantity))));
  }

  for (const line of guestLines) {
    mergedByProduct.set(line.productId, (mergedByProduct.get(line.productId) ?? 0) + line.qty);
  }

  const mergedItems = Array.from(mergedByProduct.entries()).map(([productId, qty]) => ({
    productId,
    qty
  }));

  await replaceCartForUser(supabase, userId, mergedItems);
}

export async function clearCartForUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
