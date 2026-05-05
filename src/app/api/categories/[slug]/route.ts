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
  price?: number | null;
  custom_price?: number | null;
  created_at?: string | null;
};

type SortMode = "relevance" | "date" | "asc" | "desc";

function parseSortParam(raw: string | null): SortMode {
  const v = raw?.trim().toLowerCase();
  if (v === "asc" || v === "desc" || v === "date") return v;
  return "relevance";
}

function timestampOrZero(iso: string | null | undefined): number {
  if (iso == null || iso === "") return 0;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? 0 : t;
}

function compareProductsBySort(a: DbProduct, b: DbProduct, sort: SortMode): number {
  const nameCmp = String(a.name ?? "").localeCompare(String(b.name ?? ""));

  switch (sort) {
    case "asc": {
      const pa = a.price;
      const pb = b.price;
      const aBad = pa == null || !Number.isFinite(Number(pa));
      const bBad = pb == null || !Number.isFinite(Number(pb));
      if (aBad && bBad) return nameCmp;
      if (aBad) return 1;
      if (bBad) return -1;
      const diff = Number(pa) - Number(pb);
      return diff !== 0 ? diff : nameCmp;
    }
    case "desc": {
      const pa = a.price;
      const pb = b.price;
      const aBad = pa == null || !Number.isFinite(Number(pa));
      const bBad = pb == null || !Number.isFinite(Number(pb));
      if (aBad && bBad) return nameCmp;
      if (aBad) return 1;
      if (bBad) return -1;
      const diff = Number(pb) - Number(pa);
      return diff !== 0 ? diff : nameCmp;
    }
    case "date": {
      const ta = timestampOrZero(a.created_at);
      const tb = timestampOrZero(b.created_at);
      if (tb !== ta) return tb - ta;
      return nameCmp;
    }
    case "relevance":
    default:
      return nameCmp;
  }
}

type CategoryPayload = { id: string; name: string; slug: string };

function toProduct(row: DbProduct, category: CategoryPayload): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const price =
    row.custom_price != null ? Number(row.custom_price) : row.price != null ? Number(row.price) : 0;
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price,
    rating: 4,
    discount: 0,
    thumbnail,
    images: [thumbnail, thumbnail],
    categories: [category.name],
    published: true,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined
  };
}

/**
 * Resolves hierarchical slug path to a single category.
 * 1) First segment: root category (parent_id IS NULL).
 * 2) Each following segment: child where slug = segment AND parent_id = previous id.
 */
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

  let current: CategoryPayload = {
    id: root.id,
    name: root.name,
    slug: root.slug
  };

  for (const segment of rest) {
    const { data: child, error: childError } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("parent_id", current.id)
      .eq("slug", segment)
      .maybeSingle();

    if (childError || !child) return null;

    current = {
      id: child.id,
      name: child.name,
      slug: child.slug
    };
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

/** Parse "min-max" or single "value" (capacity=12 or capacity=6-12) into [number, number] or null. */
function parseRangeParam(param: string | null): number[] | null {
  if (!param?.trim()) return null;
  const parts = param.split("-").map((s) => Number(s.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  if (parts.length === 1 && Number.isFinite(parts[0])) return [parts[0], parts[0]];
  return null;
}

/** Parse comma-separated "a,b,c" into string array (filters empty). */
function parseListParam(param: string | null): string[] | null {
  if (!param?.trim()) return null;
  const list = param.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

/** Extract numeric from values like "18TB", "512MB", or "3.5 inch". */
function parseNumericValue(value: string | null): number | null {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

/**
 * Check if param value is a range (e.g. "6-12") vs list ("3.5", "1TB,2TB").
 * Only treat as range when param contains a hyphen (min-max); otherwise single
 * values like "3.5" or "12" are list values so they match product_attributes.value exactly.
 */
function parseParamAsRangeOrList(param: string | null): { type: "range"; min: number; max: number } | { type: "list"; values: string[] } | null {
  if (!param?.trim()) return null;
  if (param.includes("-")) {
    const range = parseRangeParam(param);
    if (range != null && range.length >= 2) {
      return { type: "range", min: range[0], max: range[1] };
    }
  }
  const list = parseListParam(param);
  if (list != null && list.length > 0) return { type: "list", values: list };
  return null;
}

const LIMIT = 30;
const RESERVED_PARAMS = new Set(["page", "prices"]);
/** Chunk size for product_attributes .in("product_id", ...) to avoid URI-too-long / request failure. */
const PRODUCT_IDS_CHUNK_SIZE = 50;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    return await handleCategoryProducts(request, params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[categories GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleCategoryProducts(
  request: Request,
  params: Promise<{ slug: string }>
) {
  const { slug } = await params;
  const slugSegments = slugParamToSegments(slug);
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * LIMIT;
  const sortMode = parseSortParam(searchParams.get("sort"));
  const prices = parseRangeParam(searchParams.get("prices"));
  const safeNum = (n: unknown): number | undefined =>
    typeof n === "number" && Number.isFinite(n) ? n : undefined;
  const priceMin = safeNum(prices?.[0]);
  const priceMax = safeNum(prices?.[1]);

  if (slugSegments.length === 0) {
    return NextResponse.json(
      { error: "Category path required" },
      { status: 404 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const category = await resolveCategoryBySlugPath(supabase, slugSegments);

  if (!category) {
    return NextResponse.json(
      { error: "Category not found" },
      { status: 404 }
    );
  }

  // Load category filter attributes: which slugs are valid for this category
  const { data: caRows } = await supabase
    .from("category_attributes")
    .select("attribute_id")
    .eq("category_id", category.id);
  const categoryAttrIds = Array.from(new Set((caRows ?? []).map((r) => r.attribute_id).filter(Boolean))) as string[];
  if (categoryAttrIds.length === 0) {
    // No attribute filters; only brands + price
  }

  type AttrMeta = { id: string; slug: string };
  const attributeSlugById = new Map<string, string>();
  const attributeIdBySlug = new Map<string, string>();
  if (categoryAttrIds.length > 0) {
    const { data: attrRows } = await supabase
      .from("attributes")
      .select("id, slug")
      .in("id", categoryAttrIds);
    (attrRows ?? []).forEach((a: AttrMeta) => {
      if (a.slug) {
        attributeSlugById.set(a.id, a.slug);
        attributeIdBySlug.set(a.slug, a.id);
      }
    });
  }

  const allowedFilterKeys = new Set<string>(["brands", ...Array.from(attributeIdBySlug.keys())]);

  // Brand filter (param "brands")
  const brandsParam = searchParams.get("brands");
  const brands = parseListParam(brandsParam);
  let brandFilterNames: string[] | null = null;
  if (brands?.length) {
    const { data: brandRows } = await supabase
      .from("products")
      .select("brand")
      .eq("category_id", category.id)
      .eq("is_active", true)
      .not("brand", "is", null);
    const distinctNames = Array.from(new Set((brandRows ?? []).map((r) => r.brand).filter((n): n is string => n != null)));
    brandFilterNames = distinctNames.filter((name) =>
      brands.includes(name.toLowerCase().replace(/\s+/g, "-"))
    );
    if (brandFilterNames.length === 0) {
      return NextResponse.json({
        category,
        products: [],
        total: 0,
        page,
        totalPages: 0
      });
    }
  }

  // Attribute filters: for each param key that is an attribute slug, apply filter
  let productIdFilter: string[] | null = null;
  const { data: categoryProducts } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", category.id)
    .eq("is_active", true);
  const categoryProductIds = (categoryProducts ?? []).map((p) => p.id);

  if (categoryProductIds.length > 0 && attributeIdBySlug.size > 0) {
    const attributeSets: Set<string>[] = [];

    for (const [paramKey, paramValue] of Array.from(searchParams.entries())) {
      if (RESERVED_PARAMS.has(paramKey)) continue;
      if (!allowedFilterKeys.has(paramKey) || paramKey === "brands") continue;

      const attrId = attributeIdBySlug.get(paramKey);
      if (!attrId) continue;

      const parsed = parseParamAsRangeOrList(paramValue);
      if (!parsed) continue;

      type PaRow = { product_id: string; value: string | null };
      const allPaRows: PaRow[] = [];
      for (let i = 0; i < categoryProductIds.length; i += PRODUCT_IDS_CHUNK_SIZE) {
        const chunk = categoryProductIds.slice(i, i + PRODUCT_IDS_CHUNK_SIZE);
        const { data: paChunk, error: paError } = await supabase
          .from("product_attributes")
          .select("product_id, value")
          .eq("attribute_id", attrId)
          .in("product_id", chunk);
        if (paError) {
          console.error("[categories GET] product_attributes error:", paError.message);
          return NextResponse.json(
            { error: "Filter query failed" },
            { status: 500 }
          );
        }
        if (paChunk?.length) allPaRows.push(...(paChunk as PaRow[]));
      }

      const matchingIds = new Set<string>();

      if (parsed.type === "list") {
        const normalizedWant = new Set(
          parsed.values.map((v) => String(v).trim().toLowerCase())
        );
        allPaRows.forEach((row: PaRow) => {
          if (row.value == null) return;
          const normalized = String(row.value).trim().toLowerCase();
          if (normalized !== "" && normalizedWant.has(normalized)) {
            matchingIds.add(row.product_id);
          }
        });
      } else {
        const { min: rMin, max: rMax } = parsed;
        allPaRows.forEach((row: PaRow) => {
          const num = parseNumericValue(row.value);
          if (num != null) {
            const okMin = num >= rMin;
            const okMax = num <= rMax;
            if (okMin && okMax) matchingIds.add(row.product_id);
          } else {
            const asInt = parseInt(String(row.value), 10);
            if (!Number.isNaN(asInt) && asInt >= rMin && asInt <= rMax) {
              matchingIds.add(row.product_id);
            }
          }
        });
      }

      if (matchingIds.size === 0) {
        return NextResponse.json({
          category,
          products: [],
          total: 0,
          page,
          totalPages: 0
        });
      }
      attributeSets.push(matchingIds);
    }

    if (attributeSets.length > 0) {
      const [first, ...rest] = attributeSets;
      const intersection =
        rest.length === 0 ? first : new Set(Array.from(first).filter((id) => rest.every((s) => s.has(id))));
      productIdFilter = Array.from(intersection);
      if (productIdFilter.length === 0) {
        return NextResponse.json({
          category,
          products: [],
          total: 0,
          page,
          totalPages: 0
        });
      }
    }
  }

  let query = supabase
    .from("products")
    .select("id, name, slug, description, brand, main_image, price, custom_price", { count: "exact" })
    .eq("category_id", category.id)
    .eq("is_active", true);

  if (priceMin != null || priceMax != null) {
    if (priceMin != null) query = query.gte("price", priceMin);
    if (priceMax != null) query = query.lte("price", priceMax);
    query = query.not("price", "is", null);
  }

  if (brandFilterNames?.length) {
    query = query.in("brand", brandFilterNames);
  }

  switch (sortMode) {
    case "asc":
      query = query.order("price", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
      break;
    case "desc":
      query = query.order("price", { ascending: false, nullsFirst: false }).order("name", { ascending: true });
      break;
    case "date":
      query = query
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true });
      break;
    case "relevance":
    default:
      query = query.order("name", { ascending: true });
  }

  if (productIdFilter?.length) {
    const filteredRows: DbProduct[] = [];

    for (let i = 0; i < productIdFilter.length; i += PRODUCT_IDS_CHUNK_SIZE) {
      const chunk = productIdFilter.slice(i, i + PRODUCT_IDS_CHUNK_SIZE);
      let chunkQuery = supabase
        .from("products")
        .select("id, name, slug, description, brand, main_image, price, custom_price")
        .eq("category_id", category.id)
        .eq("is_active", true)
        .in("id", chunk);

      if (priceMin != null || priceMax != null) {
        if (priceMin != null) chunkQuery = chunkQuery.gte("price", priceMin);
        if (priceMax != null) chunkQuery = chunkQuery.lte("price", priceMax);
        chunkQuery = chunkQuery.not("price", "is", null);
      }

      if (brandFilterNames?.length) {
        chunkQuery = chunkQuery.in("brand", brandFilterNames);
      }

      const { data: chunkRows, error: chunkError } = await chunkQuery;
      if (chunkError) {
        return NextResponse.json(
          { error: chunkError.message },
          { status: 500 }
        );
      }

      filteredRows.push(...((chunkRows ?? []) as DbProduct[]));
    }

    filteredRows.sort((a, b) => compareProductsBySort(a, b, sortMode));

    const totalCount = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pageOffset = (clampedPage - 1) * LIMIT;
    const products = filteredRows
      .slice(pageOffset, pageOffset + LIMIT)
      .map((row) => toProduct(row, category));

    return NextResponse.json({
      category,
      products,
      total: totalCount,
      page: clampedPage,
      totalPages
    });
  }

  const { data: productRows, error: productsError, count: total } = await query.range(
    offset,
    offset + LIMIT - 1
  );

  if (productsError) {
    return NextResponse.json(
      { error: productsError.message },
      { status: 500 }
    );
  }

  const rows = (productRows ?? []) as DbProduct[];
  const products: Product[] = rows.map((row) => toProduct(row, category));
  const totalCount = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  return NextResponse.json({
    category,
    products,
    total: totalCount,
    page: clampedPage,
    totalPages
  });
}
