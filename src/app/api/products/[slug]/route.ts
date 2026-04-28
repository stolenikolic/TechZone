import { NextResponse } from "next/server";
import type Product from "models/Product.model";
import { createSupabaseServiceClient } from "utils/supabase";

type DbCategory = { id: string; name: string; slug: string; parent_id: string | null };

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  rating: number | null;
  price: number | null;
  original_price: number | null;
  categories: DbCategory | DbCategory[] | null;
};

function toProduct(
  product: DbProduct,
  parentCategory?: { name: string; slug: string } | null
): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category =
    raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  const rating = product.rating != null ? Number(product.rating) : 0;
  const price = product.price != null ? Number(product.price) : 0;
  const originalPrice =
    product.original_price != null && product.original_price > price
      ? Number(product.original_price)
      : undefined;
  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: Math.min(5, Math.max(0, rating)),
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    ...(category && { category: { name: category.name, slug: category.slug } }),
    ...(parentCategory && { parentCategory }),
    description: product.description ?? undefined,
    published: true
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, brand, main_image, rating, price, original_price, categories(id, name, slug, parent_id)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const row = data as DbProduct;
    const category =
      row.categories == null
        ? null
        : Array.isArray(row.categories)
          ? row.categories[0] ?? null
          : row.categories;

    let parentCategory: { name: string; slug: string } | null = null;
    if (category?.parent_id) {
      const { data: parent } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("id", category.parent_id)
        .maybeSingle();
      if (parent) {
        parentCategory = { name: parent.name, slug: parent.slug };
      }
    }

    const product: Product = toProduct(row, parentCategory);

    const { data: productImageRows } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("product_id", row.id)
      .order("sort_order", { ascending: true });

    if (productImageRows?.length) {
      product.images = productImageRows.map((r) => r.image_url);
      product.thumbnail = product.images[0];
    }

    const { data: specRows } = await supabase
      .from("product_attributes")
      .select("value, attributes(name, slug)")
      .eq("product_id", row.id);

    if (specRows?.length) {
      const specifications = specRows
        .map((r: { value: string; attributes: { name: string; slug: string } | { name: string; slug: string }[] | null }) => {
          const raw = r.attributes;
          const a = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
          return a ? { name: a.name, slug: a.slug, value: r.value } : null;
        })
        .filter((x): x is { name: string; slug: string; value: string } => x != null)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (specifications.length) product.specifications = specifications;
    }

    return NextResponse.json(product);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
