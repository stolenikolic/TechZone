import { cache } from "react";
import axios from "utils/axiosInstance";
import { createSupabaseServiceClient } from "utils/supabase";
import { getEffectivePrice, getOriginalPriceForDisplay } from "lib/effective-price";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";
import Product from "models/Product.model";

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
  custom_price: number | null;
  original_price: number | null;
  categories: DbCategory | DbCategory[] | null;
};

function rowToProduct(product: DbProduct, parentCategory?: { name: string; slug: string } | null): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  const rating = product.rating != null ? Number(product.rating) : 0;
  const price = getEffectivePrice(product.custom_price, product.price);
  const originalPrice = getOriginalPriceForDisplay(product.original_price, price);

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

// get all product slug
const getSlugs = cache(async () => {
  const response = await axios.get<SlugParams[]>("/api/products/slug-list");
  return response.data;
});

// get product based on slug. Server-side reads DB directly; no axios hop to our own API during RSC render.
const getProduct = cache(async (slug: string): Promise<Product | null> => {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, brand, main_image, rating, price, custom_price, original_price, categories(id, name, slug, parent_id)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("[product-details]", error.message);
      return null;
    }
    if (!data) return null;

    const row = data as DbProduct;
    const category = row.categories == null ? null : Array.isArray(row.categories) ? row.categories[0] ?? null : row.categories;

    let parentCategory: { name: string; slug: string } | null = null;
    if (category?.parent_id) {
      const { data: parent } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("id", category.parent_id)
        .maybeSingle();
      if (parent) parentCategory = { name: parent.name, slug: parent.slug };
    }

    const product = rowToProduct(row, parentCategory);

    const { data: productImageRows } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("product_id", row.id)
      .order("sort_order", { ascending: true });

    if (productImageRows?.length) {
      product.images = productImageRows.map((r) => r.image_url);
      product.thumbnail = product.images[0];
    }

    const attributeSortOrder = new Map<string, number>();
    if (category?.id) {
      const { data: categoryAttributeRows } = await supabase
        .from("category_attributes")
        .select("attribute_id, sort_order")
        .eq("category_id", category.id)
        .order("sort_order", { ascending: true });
      (categoryAttributeRows ?? []).forEach((row) => {
        if (row.attribute_id) attributeSortOrder.set(row.attribute_id, row.sort_order ?? 0);
      });
    }

    const { data: specRows } = await supabase
      .from("product_attributes")
      .select("value, attributes(id, name, slug)")
      .eq("product_id", row.id);

    if (specRows?.length) {
      const specifications = specRows
        .map((r: { value: string; attributes: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }) => {
          const raw = r.attributes;
          const a = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
          return a ? { id: a.id, name: a.name, slug: a.slug, value: r.value } : null;
        })
        .filter((x): x is { id: string; name: string; slug: string; value: string } => x != null)
        .sort((a, b) => {
          const aOrder = attributeSortOrder.get(a.id);
          const bOrder = attributeSortOrder.get(b.id);
          if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
          if (aOrder != null && bOrder == null) return -1;
          if (aOrder == null && bOrder != null) return 1;
          return a.name.localeCompare(b.name);
        })
        .map(({ name, slug, value }) => ({ name, slug, value }));
      if (specifications.length) product.specifications = specifications;
    }

    return product;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[product-details]", message);
    return null;
  }
});

// search products
const searchProducts = cache(async (name?: string, category?: string) => {
  const response = await axios.get<string[]>("/api/products/search", {
    params: { name, category }
  });
  return response.data;
});

export default { getSlugs, getProduct, searchProducts };
