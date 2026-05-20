import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilterItem } from "models/Filters";
import { getEffectivePrice } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";
import { buildTokenFilter, parseCategorySlugsParam } from "lib/search/product-search-tokens";
import {
  resolveCategoryIdsBySlugs,
  type SearchCategoryFacet
} from "lib/search/search-category-facets";

const PER_PAGE = 30;
const ROW_PAGE_SIZE = 1000;

export type SearchProductRow = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  original_price: number | null;
  category_id: string | null;
  created_at: string | null;
};

export type SearchFiltersPayload = {
  categoryFacets: SearchCategoryFacet[];
  priceRange?: { min: number; max: number };
  filters: FilterItem[];
};

export type SearchListingParams = {
  q: string;
  page?: number;
  sort?: string | null;
  prices?: string | null;
  brands?: string | null;
  category?: string | null;
};

export type SearchListingResult = {
  products: SearchProductRow[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  filters: SearchFiltersPayload;
};

type SortMode = "relevance" | "date" | "asc" | "desc";

function parseSortParam(raw: string | null | undefined): SortMode {
  const v = raw?.trim().toLowerCase();
  if (v === "asc" || v === "desc" || v === "date") return v;
  return "relevance";
}

function parseRangeParam(param: string | null | undefined): number[] | null {
  if (!param?.trim()) return null;
  const parts = param.split("-").map((s) => Number(s.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  if (parts.length === 1 && Number.isFinite(parts[0])) return [parts[0], parts[0]];
  return null;
}

function parseListParam(param: string | null | undefined): string[] | null {
  if (!param?.trim()) return null;
  const list = param.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

function normalizeBrandSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function fetchAllSearchProductRows(
  supabase: SupabaseClient,
  tokens: string[]
): Promise<SearchProductRow[]> {
  const rows: SearchProductRow[] = [];
  let offset = 0;

  while (true) {
    let query = applyStorefrontProductVisibility(
      supabase
        .from("products")
        .select("id,name,brand,slug,main_image,price,custom_price,original_price,category_id,created_at")
    );

    for (const token of tokens) {
      query = query.or(buildTokenFilter(token));
    }

    const { data, error } = await query.range(offset, offset + ROW_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as SearchProductRow[];
    if (batch.length === 0) break;

    rows.push(...batch);
    if (batch.length < ROW_PAGE_SIZE) break;
    offset += ROW_PAGE_SIZE;
  }

  return rows;
}

function buildCategoryFacets(
  rows: SearchProductRow[],
  categories: Array<{ id: string; slug: string; name: string }>
): SearchCategoryFacet[] {
  const countsByCategoryId = new Map<string, number>();
  for (const row of rows) {
    if (!row.category_id) continue;
    countsByCategoryId.set(row.category_id, (countsByCategoryId.get(row.category_id) ?? 0) + 1);
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return Array.from(countsByCategoryId.entries())
    .map(([categoryId, count]) => {
      const category = categoryById.get(categoryId);
      if (!category) return null;
      return { slug: category.slug, name: category.name, count };
    })
    .filter((facet): facet is SearchCategoryFacet => facet != null)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "sr");
    });
}

function buildFiltersPayload(allRows: SearchProductRow[]): SearchFiltersPayload {
  const visibleRows = allRows.filter((row) => {
    const price = getEffectivePrice(row.custom_price, row.price);
    return Number.isFinite(price) && price > 0;
  });

  const effectivePrices = visibleRows
    .map((row) => getEffectivePrice(row.custom_price, row.price))
    .filter((value) => Number.isFinite(value) && value > 0);

  const priceMin = effectivePrices.length ? Math.min(...effectivePrices) : null;
  const priceMax = effectivePrices.length ? Math.max(...effectivePrices) : null;

  const brandSet = new Set<string>();
  visibleRows.forEach((row) => {
    if (row.brand != null && row.brand !== "") brandSet.add(row.brand);
  });

  const filters: FilterItem[] = [];
  if (brandSet.size > 0) {
    filters.push({
      slug: "brand",
      name: "Brand",
      values: Array.from(brandSet).sort((a, b) => a.localeCompare(b))
    });
  }

  return {
    categoryFacets: [],
    ...(priceMin != null && priceMax != null && priceMin <= priceMax
      ? { priceRange: { min: priceMin, max: priceMax } }
      : {}),
    filters
  };
}

function compareRows(a: SearchProductRow, b: SearchProductRow, sort: SortMode): number {
  if (sort === "date") {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  }

  const aPrice = getEffectivePrice(a.custom_price, a.price);
  const bPrice = getEffectivePrice(b.custom_price, b.price);

  if (sort === "asc") return aPrice - bPrice;
  if (sort === "desc") return bPrice - aPrice;

  return a.name.localeCompare(b.name, "sr");
}

function filterRows(
  rows: SearchProductRow[],
  options: {
    categoryIds: string[];
    brandFilterNames: string[] | null;
    priceMin?: number;
    priceMax?: number;
  }
): SearchProductRow[] {
  return rows.filter((row) => {
    const effectivePrice = getEffectivePrice(row.custom_price, row.price);
    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return false;

    if (options.categoryIds.length > 0) {
      if (!row.category_id || !options.categoryIds.includes(row.category_id)) return false;
    }

    if (options.brandFilterNames?.length) {
      if (!row.brand || !options.brandFilterNames.includes(row.brand)) return false;
    }

    if (options.priceMin != null && effectivePrice < options.priceMin) return false;
    if (options.priceMax != null && effectivePrice > options.priceMax) return false;

    return true;
  });
}

export async function runSearchListing(
  supabase: SupabaseClient,
  tokens: string[],
  params: SearchListingParams
): Promise<SearchListingResult> {
  const page = Math.max(1, params.page ?? 1);
  const sortMode = parseSortParam(params.sort ?? null);
  const prices = parseRangeParam(params.prices);
  const safeNum = (n: unknown): number | undefined =>
    typeof n === "number" && Number.isFinite(n) ? n : undefined;
  const priceMin = safeNum(prices?.[0]);
  const priceMax = safeNum(prices?.[1]);

  const allRows = await fetchAllSearchProductRows(supabase, tokens);
  const basePayload = buildFiltersPayload(allRows);

  const categoryIdsInResults = Array.from(
    new Set(allRows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))
  );

  let categories: Array<{ id: string; slug: string; name: string }> = [];
  if (categoryIdsInResults.length > 0) {
    const { data, error } = await supabase
      .from("categories")
      .select("id, slug, name")
      .in("id", categoryIdsInResults);
    if (error) throw new Error(error.message);
    categories = (data ?? []) as Array<{ id: string; slug: string; name: string }>;
  }

  const categoryFacets = buildCategoryFacets(allRows, categories);

  const categorySlugs = parseCategorySlugsParam(params.category ?? null);
  const categoryIds =
    categorySlugs.length > 0 ? await resolveCategoryIdsBySlugs(supabase, categorySlugs) : [];

  const brandSlugs = parseListParam(params.brands);
  let brandFilterNames: string[] | null = null;
  if (brandSlugs?.length) {
    const distinctNames = Array.from(
      new Set(allRows.map((row) => row.brand).filter((name): name is string => name != null && name !== ""))
    );
    brandFilterNames = distinctNames.filter((name) => brandSlugs.includes(normalizeBrandSlug(name)));
    if (brandFilterNames.length === 0) {
      return {
        products: [],
        totalResults: 0,
        totalPages: 1,
        currentPage: 1,
        filters: { ...basePayload, categoryFacets }
      };
    }
  }

  if (categorySlugs.length > 0 && categoryIds.length === 0) {
    return {
      products: [],
      totalResults: 0,
      totalPages: 1,
      currentPage: 1,
      filters: { ...basePayload, categoryFacets }
    };
  }

  const filtered = filterRows(allRows, {
    categoryIds,
    brandFilterNames,
    priceMin,
    priceMax
  });

  const sorted = [...filtered].sort((a, b) => compareRows(a, b, sortMode));
  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PER_PAGE;
  const products = sorted.slice(offset, offset + PER_PAGE);

  return {
    products,
    totalResults,
    totalPages,
    currentPage,
    filters: { ...basePayload, categoryFacets }
  };
}
