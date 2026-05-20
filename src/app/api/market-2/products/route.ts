import { NextResponse } from "next/server";
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
  const category =
    raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
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

function toProductMinimal(row: {
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
}, isTopPick: boolean): Product {
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
  const idsByCategory = new Map<string, string[]>();
  rows.forEach((row) => {
    const categoryId = row.category_id;
    if (!categoryId) return;
    const list = idsByCategory.get(categoryId) ?? [];
    list.push(row.id);
    idsByCategory.set(categoryId, list);
  });
  const topPickMap = new Map<string, { productId: string; priority: number; createdAt: string }>();
  for (const [categoryId, ids] of Array.from(idsByCategory.entries())) {
    const { data } = await supabase
      .from("category_featured_products")
      .select("product_id, priority, created_at")
      .eq("category_id", categoryId)
      .in("product_id", ids);
    (data ?? []).forEach((row) =>
      topPickMap.set(row.product_id, {
        productId: row.product_id,
        priority: row.priority ?? 100,
        createdAt: row.created_at ?? ""
      })
    );
  }
  return topPickMap;
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await applyStorefrontProductVisibility(
      supabase
        .from("products")
        .select("id, name, slug, description, brand, main_image, price, custom_price, rating, categories(id, name, slug)")
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
        console.error("[market-2/products] fallback failed:", fallback.error.message);
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
      const topPickMap = await loadTopPickMapForRows(supabase, rows);
      rows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
      return NextResponse.json(rows.map((row) => toProductMinimal(row, topPickMap.has(row.id))));
    }

    const rows = (data ?? []) as DbProduct[];
    const topPickMap = await loadTopPickMapForRows(
      supabase,
      rows.map((row) => ({ id: row.id, category_id: (Array.isArray(row.categories) ? row.categories[0]?.id : row.categories?.id) ?? null }))
    );
    rows.sort((a, b) => compareTopPickThenDate(a.id, b.id, null, null, topPickMap));
    const products: Product[] = rows.map((row) => toProduct(row, topPickMap.has(row.id)));

    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[market-2/products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
