import { NextResponse } from "next/server";
import { isNotApplicableAttributeValue } from "lib/attributes/not-applicable-value";
import { getEffectivePrice } from "lib/effective-price";
import {
  fetchShopVisibleProductsForCategory,
  shopVisibleProductIds
} from "lib/shop-category-products";
import { createSupabaseServiceClient } from "utils/supabase";

type CategoryPayload = { id: string; name: string; slug: string };

async function resolveCategoryBySlugPath(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  slugSegments: string[]
): Promise<CategoryPayload | null> {
  if (!slugSegments.length) return null;

  const [first, ...rest] = slugSegments;

  const { data: root, error: rootError } = await supabase
    .from("categories")
    .select("id, name, slug")
    .is("parent_id", null)
    .eq("slug", first)
    .maybeSingle();

  if (rootError || !root) return null;

  let current: CategoryPayload = { id: root.id, name: root.name, slug: root.slug };

  for (const segment of rest) {
    const { data: child, error: childError } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("parent_id", current.id)
      .eq("slug", segment)
      .maybeSingle();

    if (childError || !child) return null;
    current = { id: child.id, name: child.name, slug: child.slug };
  }

  return current;
}

/** Parse [slug] param (single string, may encode path like "parent%2Fchild") into segments. */
function slugParamToSegments(slug: string): string[] {
  try {
    const decoded = decodeURIComponent(slug);
    return decoded.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

export type FilterItem = {
  slug: string;
  name: string;
  values: string[];
  displayType?: "checkbox" | "range";
  range?: { min: number; max: number };
  unit?: string;
  step?: number;
};

export type CategoryFiltersResponse = {
  priceRange?: { min: number; max: number };
  filters: FilterItem[];
};

type AttributeRow = {
  id: string;
  slug: string;
  name: string | null;
  filter_display_type?: string | null;
  filter_unit?: string | null;
  filter_step?: number | string | null;
};

type AttributeMeta = {
  slug: string;
  name: string;
  displayType: "checkbox" | "range";
  unit?: string;
  step?: number;
};

const RANGE_ATTRIBUTE_FALLBACKS: Record<string, { unit?: string; step?: number }> = {
  m2_connectors: { unit: "pcs", step: 1 }
};

/** Extract numeric from values like "0pcs", "1000 MB", or "3.5 inch". */
function parseNumericValue(value: string | null): number | null {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

function toAttributeMeta(row: AttributeRow): AttributeMeta {
  const fallback = RANGE_ATTRIBUTE_FALLBACKS[row.slug];
  const displayType = row.filter_display_type === "range" || fallback ? "range" : "checkbox";
  const step =
    row.filter_step != null && Number.isFinite(Number(row.filter_step))
      ? Number(row.filter_step)
      : fallback?.step;
  const unit = row.filter_unit ?? fallback?.unit;

  return {
    slug: row.slug,
    name: row.name ?? row.slug,
    displayType,
    ...(unit ? { unit } : {}),
    ...(step != null ? { step } : {})
  };
}

/**
 * Dynamic filters:
 * 1. category_attributes defines which attributes are filters for the category.
 * 2. product_attributes provides distinct values (only shop-visible masters in the category).
 * 3. Brand filter from products.brand. No hardcoded attribute names.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const slugSegments = slugParamToSegments(slug);

  if (!slugSegments.length) {
    return NextResponse.json({ error: "Category path required" }, { status: 404 });
  }

  const supabase = createSupabaseServiceClient();
  const category = await resolveCategoryBySlugPath(supabase, slugSegments);

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const result: CategoryFiltersResponse = { filters: [] };

  const visibleProducts = await fetchShopVisibleProductsForCategory(supabase, category.id);

  const effectivePrices = visibleProducts
    .map((row) => getEffectivePrice(row.custom_price, row.price))
    .filter((value) => Number.isFinite(value) && value > 0);
  const priceMin = effectivePrices.length ? Math.min(...effectivePrices) : null;
  const priceMax = effectivePrices.length ? Math.max(...effectivePrices) : null;
  if (priceMin != null && priceMax != null && priceMin <= priceMax) {
    result.priceRange = { min: priceMin, max: priceMax };
  }

  const productIds = shopVisibleProductIds(visibleProducts);
  if (productIds.length === 0) {
    return NextResponse.json(result);
  }

  const brandSet = new Set<string>();
  visibleProducts.forEach((r) => r.brand != null && r.brand !== "" && brandSet.add(r.brand));
  if (brandSet.size > 0) {
    const brandValues = Array.from(brandSet).sort((a, b) => a.localeCompare(b));
    result.filters.push({ slug: "brand", name: "Brand", values: brandValues });
  }

  const { data: caRows } = await supabase
    .from("category_attributes")
    .select("attribute_id, sort_order")
    .eq("category_id", category.id)
    .order("sort_order", { ascending: true });

  const categoryAttributeIds = Array.from(
    new Set((caRows ?? []).map((r) => r.attribute_id).filter(Boolean))
  ) as string[];
  if (categoryAttributeIds.length === 0) {
    return NextResponse.json(result);
  }

  let attrRows: AttributeRow[] = [];
  const { data: attrRowsWithMetadata, error: attrRowsWithMetadataError } = await supabase
    .from("attributes")
    .select("id, slug, name, filter_display_type, filter_unit, filter_step")
    .in("id", categoryAttributeIds);

  if (attrRowsWithMetadataError) {
    const { data: fallbackAttrRows, error: fallbackAttrRowsError } = await supabase
      .from("attributes")
      .select("id, slug, name")
      .in("id", categoryAttributeIds);

    if (fallbackAttrRowsError) {
      return NextResponse.json({ error: fallbackAttrRowsError.message }, { status: 500 });
    }

    attrRows = (fallbackAttrRows ?? []) as AttributeRow[];
  } else {
    attrRows = (attrRowsWithMetadata ?? []) as AttributeRow[];
  }

  const attributeMeta = new Map<string, AttributeMeta>();
  const orderedAttrIds: string[] = [];
  for (const aid of categoryAttributeIds) {
    const attr = attrRows.find((a) => a.id === aid);
    if (attr?.slug && !attributeMeta.has(aid)) {
      attributeMeta.set(aid, toAttributeMeta(attr));
      orderedAttrIds.push(aid);
    }
  }

  type PaRow = { value: string | null; attribute_id: string };
  const CHUNK_SIZE = 100;
  const byAttributeId = new Map<string, Set<string>>();

  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const pidChunk = productIds.slice(i, i + CHUNK_SIZE);
    const { data: paRows } = await supabase
      .from("product_attributes")
      .select("value, attribute_id")
      .in("product_id", pidChunk)
      .in("attribute_id", orderedAttrIds)
      .limit(5000);

    const rows = (paRows ?? []) as PaRow[];
    for (const row of rows) {
      if (row.value == null || String(row.value).trim() === "") continue;
      if (isNotApplicableAttributeValue(String(row.value))) continue;
      if (!attributeMeta.has(row.attribute_id)) continue;
      if (!byAttributeId.has(row.attribute_id)) byAttributeId.set(row.attribute_id, new Set());
      byAttributeId.get(row.attribute_id)!.add(String(row.value).trim());
    }
  }

  for (const attrId of orderedAttrIds) {
    const meta = attributeMeta.get(attrId);
    const valueSet = byAttributeId.get(attrId);
    if (!meta || !valueSet || valueSet.size === 0) continue;
    const values = Array.from(valueSet).sort((a, b) => String(a).localeCompare(String(b)));
    if (meta.displayType === "range") {
      const numericValues = values
        .map((value) => parseNumericValue(value))
        .filter((value): value is number => value != null);

      if (numericValues.length === 0) continue;

      result.filters.push({
        slug: meta.slug,
        name: meta.name,
        values,
        displayType: "range",
        range: {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues)
        },
        ...(meta.unit ? { unit: meta.unit } : {}),
        ...(meta.step != null ? { step: meta.step } : {})
      });
      continue;
    }

    result.filters.push({ slug: meta.slug, name: meta.name, values, displayType: "checkbox" });
  }

  return NextResponse.json(result);
}
