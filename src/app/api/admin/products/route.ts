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
  price: number | null;
  rating: number | null;
  is_active: boolean;
  mpn: string | null;
  ean: string | null;
  attributes: Record<string, unknown> | null;
  categories: DbCategory | DbCategory[] | null;
};

type MasterStatus = NonNullable<Product["masterStatus"]>;

function hasAttributesJson(value: Record<string, unknown> | null) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function getMasterStatus(
  row: DbProduct,
  supplierOffers: number,
  hasProductAttributes: boolean
): MasterStatus {
  if (supplierOffers === 0) {
    return {
      value: "unlinked",
      label: "unlinked",
      tooltip: "This master product has no linked supplier offers.",
      missing: ["supplier offer"],
      supplierOffers
    };
  }

  const missing: string[] = [];
  if (row.price == null || Number(row.price) <= 0) missing.push("price");
  if (!row.categories || (Array.isArray(row.categories) && row.categories.length === 0)) missing.push("category");
  if (!row.main_image) missing.push("image");
  if (!row.mpn && !row.ean) missing.push("MPN or EAN");

  if (missing.length > 0) {
    return {
      value: "linked",
      label: "linked",
      tooltip: `Linked to supplier offer(s), but missing: ${missing.join(", ")}.`,
      missing,
      supplierOffers
    };
  }

  if (!hasAttributesJson(row.attributes) && !hasProductAttributes) {
    return {
      value: "needs_attributes",
      label: "needs attributes",
      tooltip: "Basic product data is present, but master attributes/filter values are missing.",
      missing: ["attributes"],
      supplierOffers
    };
  }

  return {
    value: "ready",
    label: "ready",
    tooltip: "Ready: linked offer, price, category, image, MPN/EAN, and attributes are present.",
    missing: [],
    supplierOffers
  };
}

function toProduct(row: DbProduct, masterStatus: MasterStatus): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
    const rawCategory = row.categories;
    const category = rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;

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
    categories: category ? [category.name] : [],
      ...(category && { category: { name: category.name, slug: category.slug } }),
    description: row.description ?? undefined,
    published: row.is_active,
    masterStatus
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const rows: DbProduct[] = [];
    const pageSize = 1000;
    let productOffset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("products")
      .select("id, name, slug, description, brand, main_image, price, rating, is_active, mpn, ean, attributes, categories(id, name, slug, parent_id)")
        .order("created_at", { ascending: false })
        .range(productOffset, productOffset + pageSize - 1);

      if (error) {
        console.error("[admin/products]", error.message);
        return NextResponse.json([], { status: 200 });
      }

      const page = (data ?? []) as DbProduct[];
      if (page.length === 0) break;
      rows.push(...page);
      productOffset += page.length;
      if (page.length < pageSize) break;
    }

    const supplierCountByProduct = new Map<string, number>();

    const parentCategoryIdSet = new Set<string>();
    const rootCategoryById = new Map<string, { name: string; slug: string }>();
    for (const row of rows) {
      const rawCategory = row.categories;
      const category = rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
      if (!category) continue;
      if (category.parent_id) {
        parentCategoryIdSet.add(category.parent_id);
      } else {
        rootCategoryById.set(category.id, { name: category.name, slug: category.slug });
      }
    }

    const parentCategoryById = new Map<string, { name: string; slug: string }>();
    for (const [id, root] of Array.from(rootCategoryById.entries())) {
      parentCategoryById.set(id, root);
    }
    const parentIds = Array.from(parentCategoryIdSet);
    if (parentIds.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < parentIds.length; i += chunkSize) {
        const chunk = parentIds.slice(i, i + chunkSize);
        const { data: parentRows, error: parentError } = await supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", chunk);
        if (parentError) throw new Error(parentError.message);
        for (const parent of parentRows ?? []) {
          parentCategoryById.set(parent.id, { name: parent.name, slug: parent.slug });
        }
      }
    }

    // PostgREST `.in()` with hundreds of UUIDs can exceed URL length limits and fail silently in some setups.
    // Instead, scan linked supplier rows in pages and aggregate counts in memory.
    const supplierPageSize = 1000;
    let supplierOffset = 0;
    for (;;) {
      const { data: supplierRows, error: supplierError } = await supabase
        .from("supplier_products")
        .select("product_id")
        .not("product_id", "is", null)
        .order("id", { ascending: true })
        .range(supplierOffset, supplierOffset + supplierPageSize - 1);

      if (supplierError) throw new Error(supplierError.message);

      const page = (supplierRows ?? []) as { product_id: string | null }[];
      if (page.length === 0) break;

      for (const row of page) {
        if (!row.product_id) continue;
        supplierCountByProduct.set(row.product_id, (supplierCountByProduct.get(row.product_id) ?? 0) + 1);
      }

      supplierOffset += page.length;
      if (page.length < supplierPageSize) break;
    }

    const productsWithAttributes = new Set<string>();
    let attributeOffset = 0;
    for (;;) {
      const { data: attributeRows, error: attributeError } = await supabase
        .from("product_attributes")
        .select("product_id")
        .order("product_id", { ascending: true })
        .order("attribute_id", { ascending: true })
        .range(attributeOffset, attributeOffset + supplierPageSize - 1);

      if (attributeError) throw new Error(attributeError.message);

      const page = (attributeRows ?? []) as { product_id: string | null }[];
      if (page.length === 0) break;

      for (const row of page) {
        if (row.product_id) productsWithAttributes.add(row.product_id);
      }

      attributeOffset += page.length;
      if (page.length < supplierPageSize) break;
    }

    return NextResponse.json(
      rows.map((row) => {
        const product = toProduct(
          row,
          getMasterStatus(row, supplierCountByProduct.get(row.id) ?? 0, productsWithAttributes.has(row.id))
        );
        const rawCategory = row.categories;
        const category = rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
        if (category?.parent_id) {
          const parent = parentCategoryById.get(category.parent_id);
          if (parent) product.parentCategory = parent;
        }
        return product;
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/products]", message);
    return NextResponse.json([], { status: 200 });
  }
}
