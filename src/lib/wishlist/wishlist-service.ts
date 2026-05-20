import { applyStorefrontProductVisibility, isStorefrontVisibleProduct } from "lib/storefront-product-visibility";
import { createSupabaseServiceClient } from "utils/supabase";
import { mapWishlistProductRows } from "./map-wishlist-product";
import type { DbWishlistProductRow, WishlistProduct } from "./types";

const PRODUCT_SELECT =
  "id, name, slug, description, brand, main_image, rating, price, custom_price, original_price, is_active, publish_locked, categories(id, name, slug)";

export async function getWishlistIdsForUser(userId: string): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.product_id));
}

export async function getWishlistProductsByIds(ids: string[]): Promise<WishlistProduct[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)));
  if (uniqueIds.length === 0) return [];

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbWishlistProductRow[];
  return mapWishlistProductRows(rows, uniqueIds);
}

async function assertProductCanBeAdded(productId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await applyStorefrontProductVisibility(
    supabase.from("products").select("id").eq("id", productId)
  ).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Proizvod nije dostupan.");
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  await assertProductCanBeAdded(productId);

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("wishlist_items").upsert(
    { user_id: userId, product_id: productId },
    { onConflict: "user_id,product_id", ignoreDuplicates: true }
  );

  if (error) throw new Error(error.message);
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
}

export async function mergeGuestWishlist(userId: string, productIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(productIds.filter((id) => typeof id === "string" && id.trim().length > 0)));
  if (uniqueIds.length === 0) return;

  const supabase = createSupabaseServiceClient();
  const { data: existingProducts, error: productsError } = await supabase
    .from("products")
    .select("id, is_active, publish_locked")
    .in("id", uniqueIds);

  if (productsError) throw new Error(productsError.message);

  const validIds = (existingProducts ?? [])
    .filter((row) => isStorefrontVisibleProduct(row))
    .map((row) => String(row.id));

  if (validIds.length === 0) return;

  const rows = validIds.map((productId) => ({ user_id: userId, product_id: productId }));
  const { error } = await supabase.from("wishlist_items").upsert(rows, {
    onConflict: "user_id,product_id",
    ignoreDuplicates: true
  });

  if (error) throw new Error(error.message);
}
