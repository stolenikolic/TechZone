import { cache } from "react";
import { createSupabaseServiceClient } from "utils/supabase";
import { getEffectivePrice, getOriginalPriceForDisplay } from "lib/effective-price";
import Product from "models/Product.model";

type DbRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  original_price: number | null;
  rating: number | null;
};

function rowToProduct(row: DbRow): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const price = getEffectivePrice(row.custom_price, row.price);
  const originalPrice = getOriginalPriceForDisplay(row.original_price, price);
  const rating = row.rating != null ? Number(row.rating) : 0;
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
    categories: [],
    description: row.description ?? undefined,
    published: true
  };
}

async function fetchActiveProducts(limit: number, offset: number): Promise<Product[]> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, brand, main_image, price, custom_price, original_price, rating")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn("[sidebar-products]", error.message);
      return [];
    }
    return ((data ?? []) as DbRow[]).map(rowToProduct);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[sidebar-products]", message);
    return [];
  }
}

/** Server-only: reads DB directly (no axios hop to /api/* during RSC). */
export const getRelatedProducts = cache(async (): Promise<Product[]> => {
  return fetchActiveProducts(3, 0);
});

export const getFrequentlyBought = cache(async (): Promise<Product[]> => {
  return fetchActiveProducts(3, 3);
});
