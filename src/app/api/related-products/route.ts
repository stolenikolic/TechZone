import { NextResponse } from "next/server";
import type Product from "models/Product.model";
import { createSupabaseServiceClient } from "utils/supabase";

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  original_price: number | null;
  rating: number | null;
};

function toProduct(product: DbProduct): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const price = product.price != null ? Number(product.price) : 0;
  const originalPrice =
    product.original_price != null && product.original_price > price
      ? Number(product.original_price)
      : undefined;
  const rating = product.rating != null ? Number(product.rating) : 0;
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: Math.min(5, Math.max(0, rating)),
    discount: 0,
    thumbnail,
    images: [thumbnail, thumbnail],
    brand: product.brand ?? undefined,
    categories: [],
    description: product.description ?? undefined,
    published: true
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, brand, main_image, price, original_price, rating")
      .eq("is_active", true)
      .limit(3);

    if (error) {
      console.error("[related-products]", error.message);
      return NextResponse.json([], { status: 200 });
    }

    const rows = (data ?? []) as DbProduct[];
    const products: Product[] = rows.map(toProduct);

    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[related-products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
