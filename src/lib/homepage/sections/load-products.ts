import type Product from "models/Product.model";
import { compareTopPickThenDate } from "lib/category-top-picks";
import { mapProductPriceFields } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";
import { createSupabaseServiceClient } from "utils/supabase";

type DbCategory = { id: string; name: string; slug: string };

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  original_price?: number | null;
  rating: number | null;
  categories: DbCategory | DbCategory[] | null;
  category_id?: string | null;
};

function toProduct(product: DbProduct, isTopPick: boolean): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category = raw == null ? null : Array.isArray(raw) ? (raw[0] ?? null) : raw;
  const { price, originalPrice } = mapProductPriceFields(product);
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: product.rating != null ? Number(product.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    description: product.description ?? undefined,
    published: true,
    ...(isTopPick && { topPick: true, topPickLabel: "Top pick" })
  };
}

const selectFieldsMinimal =
  "id, name, slug, description, brand, main_image, price, custom_price, original_price, rating";

function toProductMinimal(
  row: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    brand: string | null;
    main_image: string | null;
    price: number | null;
    custom_price: number | null;
    original_price?: number | null;
    rating: number | null;
    category_id?: string | null;
  },
  isTopPick: boolean
): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const { price, originalPrice } = mapProductPriceFields(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: row.rating != null ? Number(row.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: [],
    description: row.description ?? undefined,
    published: true,
    ...(isTopPick && { topPick: true, topPickLabel: "Top pick" })
  };
}

async function loadTopPickMapForRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  rows: Array<{ id: string; category_id?: string | null }>
): Promise<Map<string, { productId: string; priority: number; createdAt: string }>> {
  const expectedCategoryByProduct = new Map<string, string>();
  rows.forEach((row) => {
    if (row.category_id) expectedCategoryByProduct.set(row.id, row.category_id);
  });

  const topPickMap = new Map<string, { productId: string; priority: number; createdAt: string }>();
  if (expectedCategoryByProduct.size === 0) return topPickMap;

  // Single batched lookup instead of one round trip per distinct category —
  // each extra round trip is costly when the app server and DB are in
  // different regions.
  const { data } = await supabase
    .from("category_featured_products")
    .select("product_id, category_id, priority, created_at")
    .in("category_id", Array.from(new Set(expectedCategoryByProduct.values())))
    .in("product_id", Array.from(expectedCategoryByProduct.keys()));

  (data ?? []).forEach((row) => {
    // Only count it as a top pick for the category actually shown on this card.
    if (expectedCategoryByProduct.get(row.product_id) !== row.category_id) return;
    topPickMap.set(row.product_id, {
      productId: row.product_id,
      priority: row.priority ?? 100,
      createdAt: row.created_at ?? ""
    });
  });
  return topPickMap;
}

export async function loadHomepageProducts(): Promise<Product[]> {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await applyStorefrontProductVisibility(
      supabase
        .from("products")
        .select(
          "id, name, slug, description, brand, main_image, price, custom_price, rating, categories(id, name, slug)"
        )
    )
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      const fallback = await applyStorefrontProductVisibility(
        supabase.from("products").select(`${selectFieldsMinimal}, category_id`)
      )
        .order("created_at", { ascending: false })
        .limit(6);
      if (fallback.error) {
        console.error("[homepage/products] fallback failed:", fallback.error.message);
        return [];
      }
      const rows = (fallback.data ?? []) as {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        brand: string | null;
        main_image: string | null;
        price: number | null;
        custom_price: number | null;
        rating: number | null;
        category_id?: string | null;
      }[];
      const topPickMap = await loadTopPickMapForRows(supabase, rows);
      rows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
      return rows.map((row) => toProductMinimal(row, topPickMap.has(row.id)));
    }

    const rows = (data ?? []) as DbProduct[];
    const topPickMap = await loadTopPickMapForRows(
      supabase,
      rows.map((row) => ({
        id: row.id,
        category_id: (Array.isArray(row.categories) ? row.categories[0]?.id : row.categories?.id) ?? null
      }))
    );
    rows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
    return rows.map((row) => toProduct(row, topPickMap.has(row.id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[homepage/products]", message);
    return [];
  }
}
