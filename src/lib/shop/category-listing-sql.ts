import type { SupabaseClient } from "@supabase/supabase-js";
export const LISTING_PAGE_SIZE = 30;

export type CategoryListingSqlRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  original_price: number | null;
  created_at: string | null;
  total_count: number;
};

export type AttributeFilterRpc =
  | { type: "list"; attribute_id: string; values: string[] }
  | { type: "range"; attribute_id: string; min: number; max: number };

export type CategoryFacetsRpc = {
  price_min: number | null;
  price_max: number | null;
  brands: string[];
  attribute_values: Array<{ attribute_id: string; value: string }>;
};

const RESERVED_PARAMS = new Set(["page", "prices", "sort", "brands"]);

function parseRangeParam(param: string | null): number[] | null {
  if (!param?.trim()) return null;
  const parts = param.split("-").map((s) => Number(s.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  if (parts.length === 1 && Number.isFinite(parts[0])) return [parts[0], parts[0]];
  return null;
}

function parseListParam(param: string | null): string[] | null {
  if (!param?.trim()) return null;
  const list = param.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

function parseParamAsRangeOrList(
  param: string | null
): { type: "range"; min: number; max: number } | { type: "list"; values: string[] } | null {
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

export function buildAttributeFiltersForRpc(
  searchParams: URLSearchParams,
  attributeIdBySlug: Map<string, string>
): AttributeFilterRpc[] {
  const filters: AttributeFilterRpc[] = [];

  for (const [paramKey, paramValue] of Array.from(searchParams.entries())) {
    if (RESERVED_PARAMS.has(paramKey)) continue;
    if (!attributeIdBySlug.has(paramKey)) continue;

    const attrId = attributeIdBySlug.get(paramKey);
    if (!attrId) continue;

    const parsed = parseParamAsRangeOrList(paramValue);
    if (!parsed) continue;

    if (parsed.type === "list") {
      filters.push({ type: "list", attribute_id: attrId, values: parsed.values });
    } else {
      filters.push({ type: "range", attribute_id: attrId, min: parsed.min, max: parsed.max });
    }
  }

  return filters;
}

export async function loadCategoryAttributeSlugMap(
  supabase: SupabaseClient,
  categoryId: string
): Promise<Map<string, string>> {
  const { data: caRows, error: caError } = await supabase
    .from("category_attributes")
    .select("attribute_id")
    .eq("category_id", categoryId);
  if (caError) throw new Error(caError.message);

  const categoryAttrIds = Array.from(
    new Set((caRows ?? []).map((r) => r.attribute_id).filter(Boolean))
  ) as string[];
  if (categoryAttrIds.length === 0) return new Map();

  const { data: attrRows, error: attrError } = await supabase
    .from("attributes")
    .select("id, slug")
    .in("id", categoryAttrIds);
  if (attrError) throw new Error(attrError.message);

  const map = new Map<string, string>();
  for (const row of attrRows ?? []) {
    if (row.slug && row.id) map.set(row.slug as string, row.id as string);
  }
  return map;
}

export async function fetchCategoryListingViaSql(
  supabase: SupabaseClient,
  options: {
    categoryId: string;
    searchParams: URLSearchParams;
    page: number;
    sort: string;
    attributeIdBySlug: Map<string, string>;
  }
): Promise<{ rows: CategoryListingSqlRow[]; total: number }> {
  const prices = parseRangeParam(options.searchParams.get("prices"));
  const safeNum = (n: unknown): number | undefined =>
    typeof n === "number" && Number.isFinite(n) ? n : undefined;
  const priceMin = safeNum(prices?.[0]);
  const priceMax = safeNum(prices?.[1]);
  const brandSlugs = parseListParam(options.searchParams.get("brands"));

  const attributeFilters = buildAttributeFiltersForRpc(options.searchParams, options.attributeIdBySlug);

  const { data, error } = await supabase.rpc("get_category_products_listing", {
    p_category_id: options.categoryId,
    p_brand_slugs: brandSlugs?.length ? brandSlugs.map((s) => s.toLowerCase()) : null,
    p_price_min: priceMin ?? null,
    p_price_max: priceMax ?? null,
    p_attribute_filters: attributeFilters,
    p_sort: options.sort,
    p_page: options.page,
    p_page_size: LISTING_PAGE_SIZE
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CategoryListingSqlRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { rows, total };
}

export async function fetchCategoryFacetsViaSql(
  supabase: SupabaseClient,
  categoryId: string
): Promise<CategoryFacetsRpc> {
  const { data, error } = await supabase.rpc("get_category_shop_facets", {
    p_category_id: categoryId
  });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Partial<CategoryFacetsRpc>;
  return {
    price_min: payload.price_min ?? null,
    price_max: payload.price_max ?? null,
    brands: Array.isArray(payload.brands) ? payload.brands : [],
    attribute_values: Array.isArray(payload.attribute_values) ? payload.attribute_values : []
  };
}
