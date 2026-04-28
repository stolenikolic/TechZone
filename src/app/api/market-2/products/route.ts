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
  price: number | null;
  rating: number | null;
  categories: DbCategory | DbCategory[] | null;
};

function toProduct(product: DbProduct): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category =
    raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price: product.price != null ? Number(product.price) : 0,
    rating: product.rating != null ? Number(product.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    description: product.description ?? undefined,
    published: true
  };
}

const selectFieldsMinimal = "id, name, slug, description, brand, main_image, price, rating";

function toProductMinimal(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  rating: number | null;
}): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price: row.price != null ? Number(row.price) : 0,
    rating: row.rating != null ? Number(row.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: [],
    description: row.description ?? undefined,
    published: true
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, brand, main_image, price, rating, categories(id, name, slug)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      const fallback = await supabase
        .from("products")
        .select(selectFieldsMinimal)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (fallback.error) {
        console.error("[market-2/products] fallback failed:", fallback.error.message);
        return NextResponse.json([], { status: 200 });
      }
      const rows = (fallback.data ?? []) as { id: string; name: string; slug: string; description: string | null; brand: string | null; main_image: string | null; price: number | null; rating: number | null }[];
      return NextResponse.json(rows.map(toProductMinimal));
    }

    const rows = (data ?? []) as DbProduct[];
    const products: Product[] = rows.map(toProduct);

    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[market-2/products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
