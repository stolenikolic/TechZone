import { NextResponse } from "next/server";
import type Product from "models/Product.model";
import { isNotApplicableAttributeValue } from "lib/attributes/not-applicable-value";
import { getEffectivePrice } from "lib/effective-price";
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
  custom_price: number | null;
  rating: number | null;
  is_active: boolean;
  mpn: string | null;
  ean: string | null;
  attributes: Record<string, unknown> | null;
  categories: DbCategory | DbCategory[] | null;
};

type MasterStatus = NonNullable<Product["masterStatus"]>;
type AdminProduct = Product & {
  basePrice: number | null;
  customPrice: number | null;
  effectivePrice: number;
};

function hasAttributesJson(value: Record<string, unknown> | null) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

type CategoryAttrReq = { attributeId: string; slug: string };

/** Non-empty manual value in products.attributes JSON (admin / legacy). */
function manualJsonHasValue(attrs: Record<string, unknown> | null, slug: string): boolean {
  if (!attrs || typeof attrs !== "object") return false;
  const v = attrs[slug];
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length === 0) return false;
    if (isNotApplicableAttributeValue(t)) return true;
    return true;
  }
  if (typeof v === "number" && Number.isFinite(v)) return true;
  if (typeof v === "boolean") return true;
  return false;
}

function hasCategoryAttributeValue(
  attrs: Record<string, unknown> | null,
  req: CategoryAttrReq,
  presentIds: Set<string>,
  valuesBySlug: Map<string, string> | undefined
): boolean {
  const tableVal = valuesBySlug?.get(req.slug);
  if (tableVal !== undefined) {
    const t = tableVal.trim();
    if (t.length === 0) return false;
    return true;
  }
  if (presentIds.has(req.attributeId)) return true;
  return manualJsonHasValue(attrs, req.slug);
}

function getMasterStatus(
  row: DbProduct,
  supplierOffers: number,
  categoryReqByCategoryId: Map<string, CategoryAttrReq[]>,
  productAttributeIds: Map<string, Set<string>>,
  productAttributeValues: Map<string, Map<string, string>>
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
  const effectivePrice = getEffectivePrice(row.custom_price, row.price);
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) missing.push("price");
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

  const rawCategory = row.categories;
  const category =
    rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
  const required = category?.id ? categoryReqByCategoryId.get(category.id) ?? [] : [];
  const presentIds = productAttributeIds.get(row.id) ?? new Set<string>();
  const valuesBySlug = productAttributeValues.get(row.id);

  const missingSlugSet = new Set<string>();
  for (const req of required) {
    if (!hasCategoryAttributeValue(row.attributes, req, presentIds, valuesBySlug)) {
      missingSlugSet.add(req.slug);
    }
  }
  const missingSlugs = Array.from(missingSlugSet);

  if (missingSlugs.length > 0) {
    const preview = missingSlugs.slice(0, 14).join(", ");
    return {
      value: "needs_attributes",
      label: "needs attributes",
      tooltip: `Missing ${missingSlugs.length} category attribute(s): ${preview}${missingSlugs.length > 14 ? ", …" : ""}.`,
      missing: missingSlugs,
      supplierOffers
    };
  }

  // Category has no rows in category_attributes: keep a light guard so totally empty masters still surface.
  if (required.length === 0 && !hasAttributesJson(row.attributes) && presentIds.size === 0) {
    return {
      value: "needs_attributes",
      label: "needs attributes",
      tooltip:
        "No category attribute template is configured for this category, and this product has no attribute values yet.",
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

function toProduct(row: DbProduct, masterStatus: MasterStatus): AdminProduct {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
    const rawCategory = row.categories;
    const category = rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
  const effectivePrice = getEffectivePrice(row.custom_price, row.price);

  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price: effectivePrice,
    rating: row.rating != null ? Number(row.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: category ? [category.name] : [],
      ...(category && { category: { name: category.name, slug: category.slug } }),
    description: row.description ?? undefined,
    published: row.is_active,
    masterStatus,
    // Admin-only enrichment for table columns.
    basePrice: row.price != null ? Number(row.price) : null,
    customPrice: row.custom_price != null ? Number(row.custom_price) : null,
    effectivePrice
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
      .select("id, name, slug, description, brand, main_image, price, custom_price, rating, is_active, mpn, ean, attributes, categories(id, name, slug, parent_id)")
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

    const { data: attributeSlugRows, error: attributeSlugError } = await supabase
      .from("attributes")
      .select("id, slug");
    if (attributeSlugError) throw new Error(attributeSlugError.message);
    const attributeIdToSlug = new Map<string, string>();
    for (const a of attributeSlugRows ?? []) {
      if (a.id && a.slug) attributeIdToSlug.set(a.id as string, a.slug as string);
    }

    const productAttributeIds = new Map<string, Set<string>>();
    const productAttributeValues = new Map<string, Map<string, string>>();
    let attributeOffset = 0;
    for (;;) {
      const { data: attributeRows, error: attributeError } = await supabase
        .from("product_attributes")
        .select("product_id, attribute_id, value")
        .order("product_id", { ascending: true })
        .order("attribute_id", { ascending: true })
        .range(attributeOffset, attributeOffset + supplierPageSize - 1);

      if (attributeError) throw new Error(attributeError.message);

      const page = (attributeRows ?? []) as {
        product_id: string | null;
        attribute_id: string | null;
        value: string | null;
      }[];
      if (page.length === 0) break;

      for (const row of page) {
        if (!row.product_id || !row.attribute_id) continue;
        if (!productAttributeIds.has(row.product_id)) productAttributeIds.set(row.product_id, new Set());
        productAttributeIds.get(row.product_id)!.add(row.attribute_id);
        const slug = attributeIdToSlug.get(row.attribute_id);
        if (slug && row.value != null) {
          if (!productAttributeValues.has(row.product_id)) {
            productAttributeValues.set(row.product_id, new Map());
          }
          productAttributeValues.get(row.product_id)!.set(slug, String(row.value));
        }
      }

      attributeOffset += page.length;
      if (page.length < supplierPageSize) break;
    }

    const categoryReqByCategoryId = new Map<string, CategoryAttrReq[]>();
    const categoryIdSet = new Set<string>();
    for (const row of rows) {
      const rawCategory = row.categories;
      const category =
        rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
      if (category?.id) categoryIdSet.add(category.id);
    }
    const categoryIdList = Array.from(categoryIdSet);
    const caChunk = 200;
    for (let i = 0; i < categoryIdList.length; i += caChunk) {
      const chunk = categoryIdList.slice(i, i + caChunk);
      const { data: caRows, error: caError } = await supabase
        .from("category_attributes")
        .select("category_id, attribute_id, attributes(slug), sort_order")
        .in("category_id", chunk)
        .order("sort_order", { ascending: true });
      if (caError) throw new Error(caError.message);
      for (const r of caRows ?? []) {
        const cid = r.category_id as string;
        const aid = r.attribute_id as string;
        const attrs = r.attributes as { slug: string } | { slug: string }[] | null;
        const slug = Array.isArray(attrs) ? attrs[0]?.slug ?? "" : attrs?.slug ?? "";
        if (!cid || !aid || !slug) continue;
        if (!categoryReqByCategoryId.has(cid)) categoryReqByCategoryId.set(cid, []);
        categoryReqByCategoryId.get(cid)!.push({ attributeId: aid, slug });
      }
    }

    return NextResponse.json(
      rows.map((row) => {
        const product = toProduct(
          row,
          getMasterStatus(
            row,
            supplierCountByProduct.get(row.id) ?? 0,
            categoryReqByCategoryId,
            productAttributeIds,
            productAttributeValues
          )
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
