import { NextResponse } from "next/server";
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
};

export type CategoryFiltersResponse = {
  priceRange?: { min: number; max: number };
  filters: FilterItem[];
};

/**
 * Dynamic filters:
 * 1. category_attributes defines which attributes are filters for the category.
 * 2. product_attributes provides distinct values (only for products in the category).
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

  const { data: minPriceRow } = await supabase
    .from("products")
    .select("price")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .not("price", "is", null)
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: maxPriceRow } = await supabase
    .from("products")
    .select("price")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .not("price", "is", null)
    .order("price", { ascending: false })
    .limit(1)
    .maybeSingle();

  const priceMin = minPriceRow?.price != null ? Number(minPriceRow.price) : null;
  const priceMax = maxPriceRow?.price != null ? Number(maxPriceRow.price) : null;
  if (priceMin != null && priceMax != null && priceMin <= priceMax) {
    result.priceRange = { min: priceMin, max: priceMax };
  }

  const { data: productRows } = await supabase
    .from("products")
    .select("id, brand")
    .eq("category_id", category.id)
    .eq("is_active", true);

  const productIds = (productRows ?? []).map((p) => p.id);
  if (productIds.length === 0) {
    return NextResponse.json(result);
  }

  const brandSet = new Set<string>();
  (productRows ?? []).forEach((r) => r.brand != null && r.brand !== "" && brandSet.add(r.brand));
  if (brandSet.size > 0) {
    const brandValues = Array.from(brandSet).sort((a, b) => a.localeCompare(b));
    result.filters.push({ slug: "brand", name: "Brand", values: brandValues });
  }

  const { data: caRows } = await supabase
    .from("category_attributes")
    .select("attribute_id")
    .eq("category_id", category.id);

  const categoryAttributeIds = Array.from(new Set((caRows ?? []).map((r) => r.attribute_id).filter(Boolean))) as string[];
  if (categoryAttributeIds.length === 0) {
    return NextResponse.json(result);
  }

  const { data: attrRows } = await supabase
    .from("attributes")
    .select("id, slug, name")
    .in("id", categoryAttributeIds);

  const attributeMeta = new Map<string, { slug: string; name: string }>();
  const orderedAttrIds: string[] = [];
  for (const aid of categoryAttributeIds) {
    const attr = (attrRows ?? []).find((a) => a.id === aid);
    if (attr?.slug && !attributeMeta.has(aid)) {
      attributeMeta.set(aid, { slug: attr.slug, name: attr.name ?? attr.slug });
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
    result.filters.push({ slug: meta.slug, name: meta.name, values });
  }

  return NextResponse.json(result);
}
