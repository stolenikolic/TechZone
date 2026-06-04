import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "contexts/CartContext";
import { getEffectivePrice } from "lib/effective-price";
import { buildCartLineId, parseCartLineId } from "./cart-line-id";
import { enrichCartItemsDelivery, hydrateCartItemsFromOffers } from "./offer-pricing";
import { applyStorefrontProductVisibility, isStorefrontVisibleProduct } from "lib/storefront-product-visibility";
import type { CartLineInput, DbCartItemRow, DbCartProductRow } from "./types";

const PRODUCT_SELECT = "id, name, slug, main_image, price, custom_price, is_active, publish_locked";

export function normalizeLineInputs(
  items: {
    id?: string;
    productId?: string;
    supplierProductId?: string;
    qty?: unknown;
  }[]
): CartLineInput[] {
  const byKey = new Map<string, CartLineInput>();

  for (const item of items) {
    let productId = typeof item.productId === "string" ? item.productId.trim() : "";
    let supplierProductId =
      typeof item.supplierProductId === "string" ? item.supplierProductId.trim() : "";

    if ((!productId || !supplierProductId) && typeof item.id === "string") {
      const parsed = parseCartLineId(item.id);
      productId = productId || parsed.productId;
      supplierProductId = supplierProductId || parsed.supplierProductId || "";
    }

    if (!productId || !supplierProductId) continue;

    const qtyRaw = typeof item.qty === "number" ? item.qty : Number(item.qty);
    if (!Number.isFinite(qtyRaw)) continue;

    const qty = Math.max(1, Math.floor(qtyRaw));
    const key = `${productId}:${supplierProductId}`;
    byKey.set(key, {
      productId,
      supplierProductId,
      qty: (byKey.get(key)?.qty ?? 0) + qty
    });
  }

  return Array.from(byKey.values());
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

function buildMinimalCartItemFromDb(
  product: DbCartProductRow,
  supplierProductId: string,
  qty: number
): CartItem | null {
  const productId = String(product.id);
  const price = getEffectivePrice(product.custom_price, product.price);
  if (price <= 0) return null;

  return {
    id: buildCartLineId(productId, supplierProductId),
    productId,
    supplierProductId,
    offerChoice: "cheapest",
    slug: product.slug?.trim() || productId,
    title: product.name?.trim() || "Product",
    thumbnail: product.main_image ?? "/assets/images/placeholder.png",
    price,
    qty: Math.max(1, Math.floor(qty))
  };
}

export async function getCartForUser(supabase: SupabaseClient, userId: string): Promise<CartItem[]> {
  const { data: cartRows, error: cartError } = await supabase
    .from("cart_items")
    .select("product_id, supplier_product_id, quantity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (cartError) throw new Error(cartError.message);

  const rows = (cartRows ?? []) as DbCartItemRow[];
  if (rows.length === 0) return [];

  const productIds = rows.map((row) => String(row.product_id));
  const productsById = await fetchProductsByIds(supabase, productIds);

  const hydrateInputs = rows
    .map((row) => {
      const product = productsById.get(String(row.product_id));
      if (!product) return null;
      return {
        product: {
          id: String(product.id),
          name: product.name,
          slug: product.slug,
          main_image: product.main_image,
          price: product.price,
          custom_price: product.custom_price
        },
        supplierProductId: String(row.supplier_product_id),
        qty: row.quantity
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (hydrateInputs.length === 0) return [];

  const hydrated = await hydrateCartItemsFromOffers(supabase, hydrateInputs);
  if (hydrated.length >= hydrateInputs.length) return hydrated;

  const hydratedIds = new Set(hydrated.map((item) => item.id));
  const fallbackItems: CartItem[] = [];

  for (const input of hydrateInputs) {
    const lineId = buildCartLineId(input.product.id, input.supplierProductId);
    if (hydratedIds.has(lineId)) continue;

    const product = productsById.get(input.product.id);
    if (!product) continue;

    const minimal = buildMinimalCartItemFromDb(product, input.supplierProductId, input.qty);
    if (minimal) fallbackItems.push(minimal);
  }

  return enrichCartItemsDelivery(supabase, [...hydrated, ...fallbackItems]);
}

export async function replaceCartForUser(
  supabase: SupabaseClient,
  userId: string,
  items: {
    id?: string;
    productId?: string;
    supplierProductId?: string;
    qty?: unknown;
  }[]
): Promise<void> {
  const normalized = normalizeLineInputs(items);

  if (normalized.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  const productIds = normalized.map((line) => line.productId);
  const productsById = await fetchVisibleProducts(supabase, productIds);
  const validLines = normalized.filter((line) => productsById.has(line.productId));

  if (validLines.length === 0) return;

  const now = new Date().toISOString();
  const insertRows = validLines.map((line) => ({
    user_id: userId,
    product_id: line.productId,
    supplier_product_id: line.supplierProductId,
    quantity: line.qty,
    updated_at: now
  }));

  const { error: insertError } = await supabase.from("cart_items").insert(insertRows);
  if (insertError) throw new Error(insertError.message);
}

export async function mergeGuestCart(
  supabase: SupabaseClient,
  userId: string,
  guestItems: {
    id?: string;
    productId?: string;
    supplierProductId?: string;
    qty?: unknown;
  }[]
): Promise<void> {
  const guestLines = normalizeLineInputs(guestItems);
  if (guestLines.length === 0) return;

  const { data: allServerRows, error: allError } = await supabase
    .from("cart_items")
    .select("product_id, supplier_product_id, quantity")
    .eq("user_id", userId);

  if (allError) throw new Error(allError.message);

  const mergedByKey = new Map<string, CartLineInput>();

  for (const row of allServerRows ?? []) {
    const productId = String(row.product_id);
    const supplierProductId = String(row.supplier_product_id);
    const key = `${productId}:${supplierProductId}`;
    mergedByKey.set(key, {
      productId,
      supplierProductId,
      qty: Math.max(1, Math.floor(Number(row.quantity)))
    });
  }

  for (const line of guestLines) {
    const key = `${line.productId}:${line.supplierProductId}`;
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, {
      ...line,
      qty: (existing?.qty ?? 0) + line.qty
    });
  }

  await replaceCartForUser(supabase, userId, Array.from(mergedByKey.values()));
}

export async function clearCartForUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
