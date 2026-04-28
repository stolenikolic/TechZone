import { NextResponse } from "next/server";
import type Product from "models/Product.model";
import { createSupabaseServiceClient } from "utils/supabase";

type DbCategory = { id: string; name: string; slug: string };

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  discount_percent: number | null;
  categories: DbCategory | DbCategory[] | null;
};

const selectFields =
  "id, name, slug, description, brand, main_image, discount_percent, categories(id, name, slug)";

function toProduct(product: DbProduct): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category =
    raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price: Math.floor(Math.random() * 500) + 100,
    rating: 0,
    discount: product.discount_percent ?? 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    description: product.description ?? undefined,
    published: true
  };
}

/** Minimal select for fallback (no is_flash_deal, no discount_percent, no relation). */
const selectFieldsMinimal = "id, name, slug, description, brand, main_image";

function toProductMinimal(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
}): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price: Math.floor(Math.random() * 500) + 100,
    rating: 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: [],
    description: row.description ?? undefined,
    published: true
  };
}

/**
 * Flash Deals: products where is_flash_deal = true (limit 6).
 * If fewer than 6, fallback to newest products to fill.
 * If is_flash_deal or discount_percent columns are missing, returns 6 newest products.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data: flashData, error: flashError } = await supabase
      .from("products")
      .select(selectFields)
      .eq("is_active", true)
      .eq("is_flash_deal", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (flashError) {
      const fallback = await supabase
        .from("products")
        .select(selectFieldsMinimal)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (fallback.error) {
        console.error("[flash-deals] fallback failed:", fallback.error.message);
        return NextResponse.json([], { status: 200 });
      }
      const rows = (fallback.data ?? []) as { id: string; name: string; slug: string; description: string | null; brand: string | null; main_image: string | null }[];
      return NextResponse.json(rows.map(toProductMinimal));
    }

    const flashRows = (flashData ?? []) as DbProduct[];
    let products: Product[] = flashRows.map(toProduct);

    if (products.length < 6) {
      const existingIds = new Set(flashRows.map((r) => r.id));
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
        products = [...products, ...toAdd.map(toProduct)];
      }
    }

    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[flash-deals]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
