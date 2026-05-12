import { NextResponse } from "next/server";
import type Product from "models/Product.model";
import { compareTopPickThenDate } from "lib/category-top-picks";
import { getEffectivePrice } from "lib/effective-price";
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
  rating: number | null;
  discount_percent: number | null;
  categories: DbCategory | DbCategory[] | null;
};

const selectFields =
  "id, name, slug, description, brand, main_image, price, custom_price, rating, discount_percent, categories(id, name, slug)";

function toProduct(product: DbProduct, isTopPick: boolean): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category =
    raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price: getEffectivePrice(product.custom_price, product.price),
    rating: product.rating != null ? Number(product.rating) : 0,
    discount: product.discount_percent ?? 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    description: product.description ?? undefined,
    published: true,
    ...(isTopPick && { topPick: true, topPickLabel: "Top pick" })
  };
}

/** Minimal select for fallback when is_featured / discount_percent / relation missing. */
const selectFieldsMinimal = "id, name, slug, description, brand, main_image, price, custom_price, rating";

function toProductMinimal(row: {
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
}, isTopPick: boolean): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price: getEffectivePrice(row.custom_price, row.price),
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

async function loadTopPickIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  rows: Array<{ id: string; categoryId: string | null }>
): Promise<Map<string, { productId: string; priority: number; createdAt: string }>> {
  const map = new Map<string, string[]>();
  rows.forEach((row) => {
    if (!row.categoryId) return;
    const list = map.get(row.categoryId) ?? [];
    list.push(row.id);
    map.set(row.categoryId, list);
  });
  const ids = new Map<string, { productId: string; priority: number; createdAt: string }>();
  for (const [categoryId, productIds] of Array.from(map.entries())) {
    const { data } = await supabase
      .from("category_featured_products")
      .select("product_id, priority, created_at")
      .eq("category_id", categoryId)
      .in("product_id", productIds);
    (data ?? []).forEach((row) =>
      ids.set(row.product_id, {
        productId: row.product_id,
        priority: row.priority ?? 100,
        createdAt: row.created_at ?? ""
      })
    );
  }
  return ids;
}

/**
 * Top Rated / Featured: products where is_featured = true (limit 6).
 * If fewer than 6, fallback to newest products to fill.
 * If is_featured or schema columns missing, returns 6 newest products.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data: featuredData, error: featuredError } = await supabase
      .from("products")
      .select(selectFields)
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (featuredError) {
      const fallback = await supabase
        .from("products")
        .select(`${selectFieldsMinimal}, category_id`)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (fallback.error) {
        console.error("[top-rated] fallback failed:", fallback.error.message);
        return NextResponse.json([], { status: 200 });
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
      const topPickMap = await loadTopPickIds(
        supabase,
        rows.map((row) => ({ id: row.id, categoryId: row.category_id ?? null }))
      );
      rows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
      return NextResponse.json(rows.map((row) => toProductMinimal(row, topPickMap.has(row.id))));
    }

    const featuredRows = (featuredData ?? []) as DbProduct[];
    const topPickMap = await loadTopPickIds(
      supabase,
      featuredRows.map((row) => ({
        id: row.id,
        categoryId: (Array.isArray(row.categories) ? row.categories[0]?.id : row.categories?.id) ?? null
      }))
    );
    featuredRows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
    let products: Product[] = featuredRows.map((row) => toProduct(row, topPickMap.has(row.id)));

    if (products.length < 6) {
      const existingIds = new Set(featuredRows.map((r) => r.id));
      const need = 6 - products.length;

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("products")
        .select(selectFields)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(need + Array.from(existingIds).length);

      if (!fallbackError && fallbackData?.length) {
        const fallbackRows = (fallbackData as DbProduct[]).filter(
          (r) => !existingIds.has(r.id)
        );
        const toAdd = fallbackRows.slice(0, need);
        const fallbackTopPickIds = await loadTopPickIds(
          supabase,
          toAdd.map((row) => ({
            id: row.id,
            categoryId: (Array.isArray(row.categories) ? row.categories[0]?.id : row.categories?.id) ?? null
          }))
        );
        toAdd.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, fallbackTopPickIds));
        products = [...products, ...toAdd.map((row) => toProduct(row, fallbackTopPickIds.has(row.id)))];
      }
    }

    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[top-rated]", message);
    return NextResponse.json([], { status: 200 });
  }
}
