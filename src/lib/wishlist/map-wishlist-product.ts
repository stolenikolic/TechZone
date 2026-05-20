import { getEffectivePrice, getOriginalPriceForDisplay } from "lib/effective-price";
import { isStorefrontVisibleProduct } from "lib/storefront-product-visibility";
import type { DbWishlistProductRow, WishlistProduct } from "./types";

function rowToProduct(row: DbWishlistProductRow): WishlistProduct {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const raw = row.categories;
  const category = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  const rating = row.rating != null ? Number(row.rating) : 0;
  const price = getEffectivePrice(row.custom_price, row.price);
  const originalPrice = getOriginalPriceForDisplay(row.original_price, price);
  const isUnavailable = !isStorefrontVisibleProduct(row);

  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: Math.min(5, Math.max(0, rating)),
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: category ? [category.name] : [],
    ...(category && { category: { name: category.name, slug: category.slug } }),
    description: row.description ?? undefined,
    published: true,
    ...(isUnavailable && { isUnavailable: true })
  };
}

export function mapWishlistProductRows(rows: DbWishlistProductRow[], orderedIds: string[]): WishlistProduct[] {
  const byId = new Map(rows.map((row) => [row.id, rowToProduct(row)]));
  return orderedIds.map((id) => byId.get(id)).filter((p): p is WishlistProduct => p != null);
}
