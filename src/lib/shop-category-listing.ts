import { cache } from "react";
import { unstable_cache } from "next/cache";
import type Product from "models/Product.model";
import type { FilterItem } from "models/Filters";
import { isNotApplicableAttributeValue } from "lib/attributes/not-applicable-value";
import { loadTopPickMapByCategory, type CategoryTopPick } from "lib/category-top-picks";
import { mapProductPriceFields } from "lib/effective-price";
import { parseNumericFromAttributeValue } from "lib/shop/range-filter-utils";
import {
  fetchCategoryFacetsViaSql,
  fetchCategoryListingViaSql,
  LISTING_PAGE_SIZE,
  loadCategoryAttributeSlugMap
} from "lib/shop/category-listing-sql";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryImageDisplayUrl } from "lib/images/category-display-url";
import { createSupabaseServiceClient } from "utils/supabase";

const DEFAULT_CATEGORY_OG_IMAGE = "/assets/images/categories/default-category.jpg";

/** Chunk size for product_attributes .in("product_id", ...) — keep in sync across listing + facets. */
export const PRODUCT_ATTRIBUTES_CHUNK_SIZE = 50;

const LISTING_LIMIT = LISTING_PAGE_SIZE;

/** Next.js Data Cache TTL for category listing (per URL). */
export const CATEGORY_LISTING_REVALIDATE_SECONDS = 60;

/** Facet sidebar is stable longer — separate cache from listing. */
export const CATEGORY_FILTERS_REVALIDATE_SECONDS = 300;

export function categoryListingTagForId(categoryId: string): string {
  return `category-listing-${categoryId}`;
}

export function categoryListingTagForPath(categoryPathOrSlug: string): string {
  return `category-listing-path-${normalizeCategorySlugParam(categoryPathOrSlug)}`;
}

function categoryListingRevalidateTags(categoryId: string, categoryPath: string): string[] {
  return [categoryListingTagForId(categoryId), categoryListingTagForPath(categoryPath)];
}

export type CategoryPayload = { id: string; name: string; slug: string };

export type CategoryFiltersResponse = {
  priceRange?: { min: number; max: number };
  filters: FilterItem[];
};

export type CategoryProductsListingResult = {
  category: CategoryPayload;
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
};

export type CategoryPageData = {
  category: CategoryPayload;
  listing: CategoryProductsListingResult;
  filters: CategoryFiltersResponse;
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

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price?: number | null;
  custom_price?: number | null;
  original_price?: number | null;
  created_at?: string | null;
};

type SortMode = "relevance" | "date" | "asc" | "desc";

const RANGE_ATTRIBUTE_FALLBACKS: Record<string, { unit?: string; step?: number }> = {
  m2_connectors: { unit: "pcs", step: 1 }
};

export function slugParamToSegments(slug: string): string[] {
  try {
    const decoded = decodeURIComponent(slug);
    return decoded.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

export async function resolveCategoryBySlugPath(
  supabase: SupabaseClient,
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

/** Stable cache key whether slug param is `a/b` or `a%2Fb`. */
export function normalizeCategorySlugParam(slugOrPath: string): string {
  return slugParamToSegments(slugOrPath).join("/");
}

// Cross-request cached (not just per-request deduped) — category id/name/slug
// rarely changes, so avoid re-walking the path segment-by-segment against the DB
// on every request.
export const resolveCategoryBySlugPathCached = cache(
  unstable_cache(
    async (normalizedPath: string) => {
      const segments = slugParamToSegments(normalizedPath);
      if (!segments.length) return null;
      const supabase = createSupabaseServiceClient();
      return resolveCategoryBySlugPath(supabase, segments);
    },
    ["category-slug-resolve"],
    { revalidate: CATEGORY_LISTING_REVALIDATE_SECONDS }
  )
);

function resolveCategoryCached(slugOrPath: string) {
  return resolveCategoryBySlugPathCached(normalizeCategorySlugParam(slugOrPath));
}

/** OG/Twitter slika za kategoriju (storage URL ili default). */
export async function getCategoryImageUrlForPath(categoryPath: string): Promise<string> {
  const category = await resolveCategoryCached(categoryPath);
  if (!category) return DEFAULT_CATEGORY_OG_IMAGE;

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("categories")
    .select("image_url")
    .eq("id", category.id)
    .maybeSingle();

  const raw = data?.image_url?.trim();
  return categoryImageDisplayUrl(raw || DEFAULT_CATEGORY_OG_IMAGE) || DEFAULT_CATEGORY_OG_IMAGE;
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

export async function buildCategoryFiltersPayload(
  supabase: SupabaseClient,
  category: CategoryPayload
): Promise<CategoryFiltersResponse | { error: string }> {
  const result: CategoryFiltersResponse = { filters: [] };

  const facets = await fetchCategoryFacetsViaSql(supabase, category.id);

  const priceMin = facets.price_min;
  const priceMax = facets.price_max;
  if (priceMin != null && priceMax != null && priceMin <= priceMax) {
    result.priceRange = { min: priceMin, max: priceMax };
  }

  if (facets.brands.length > 0) {
    result.filters.push({
      slug: "brand",
      name: "Brand",
      values: [...facets.brands].sort((a, b) => a.localeCompare(b))
    });
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
    return result;
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
      return { error: fallbackAttrRowsError.message };
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

  const byAttributeId = new Map<string, Set<string>>();

  for (const row of facets.attribute_values) {
    if (!row.value || row.value.trim() === "") continue;
    if (isNotApplicableAttributeValue(row.value)) continue;
    if (!attributeMeta.has(row.attribute_id)) continue;
    if (!byAttributeId.has(row.attribute_id)) byAttributeId.set(row.attribute_id, new Set());
    byAttributeId.get(row.attribute_id)!.add(row.value.trim());
  }

  for (const attrId of orderedAttrIds) {
    const meta = attributeMeta.get(attrId);
    const valueSet = byAttributeId.get(attrId);
    if (!meta || !valueSet || valueSet.size === 0) continue;
    const values = Array.from(valueSet).sort((a, b) => String(a).localeCompare(String(b)));
    if (meta.displayType === "range") {
      const numericValues = values
        .map((value) => parseNumericFromAttributeValue(value))
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

  return result;
}

function parseSortParam(raw: string | null): SortMode {
  const v = raw?.trim().toLowerCase();
  if (v === "asc" || v === "desc" || v === "date") return v;
  return "relevance";
}

function toProduct(
  row: DbProduct,
  category: CategoryPayload,
  topPickMap: Map<string, CategoryTopPick>
): Product {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const { price, originalPrice } = mapProductPriceFields(row);
  const isTopPick = topPickMap.has(row.id);
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: 4,
    discount: 0,
    thumbnail,
    images: [thumbnail, thumbnail],
    categories: [category.name],
    published: true,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    ...(isTopPick && { topPick: true, topPickLabel: "Top pick" })
  };
}

function filterParamsToSearchParams(
  filterParams: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filterParams)) {
    if (value === undefined || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
}

/** Cache key for listing / full page (category path + page + active filters + sort). */
function buildCategoryListingCacheKey(
  categoryPath: string,
  page: number,
  filterParams: Record<string, string | string[] | undefined>
): string {
  const normalized = normalizeCategorySlugParam(categoryPath);
  const params = filterParamsToSearchParams(filterParams);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const query = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return query ? `${normalized}|${query}` : normalized;
}

export type CategoryListingError = { error: string; status: number };

export async function getCategoryProductsListing(
  supabase: SupabaseClient,
  category: CategoryPayload,
  searchParams: URLSearchParams
): Promise<CategoryProductsListingResult | CategoryListingError> {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const sortMode = parseSortParam(searchParams.get("sort"));

  try {
    const [topPickMap, attributeIdBySlug] = await Promise.all([
      loadTopPickMapByCategory(category.id),
      loadCategoryAttributeSlugMap(supabase, category.id)
    ]);

    const { rows, total } = await fetchCategoryListingViaSql(supabase, {
      categoryId: category.id,
      searchParams,
      page,
      sort: sortMode,
      attributeIdBySlug
    });

    const totalPages = total > 0 ? Math.max(1, Math.ceil(total / LISTING_LIMIT)) : 0;
    const clampedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : page;
    const products = rows.map((row) =>
      toProduct(
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          brand: row.brand,
          main_image: row.main_image,
          price: row.price,
          custom_price: row.custom_price,
          original_price: row.original_price,
          created_at: row.created_at
        },
        category,
        topPickMap
      )
    );

    return {
      category,
      products,
      total,
      page: clampedPage,
      totalPages
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, status: 500 };
  }
}

async function loadCategoryFiltersForPath(
  slugOrPath: string
): Promise<CategoryFiltersResponse | { error: string } | null> {
  const category = await resolveCategoryCached(slugOrPath);
  if (!category) return null;

  const supabase = createSupabaseServiceClient();
  return buildCategoryFiltersPayload(supabase, category);
}

/** Facet sidebar for a category (independent of active filters). Cached 60s per category path. */
export async function getCategoryFiltersForPath(
  slugOrPath: string
): Promise<CategoryFiltersResponse | { error: string } | null> {
  const category = await resolveCategoryCached(slugOrPath);
  if (!category) return null;

  const normalized = normalizeCategorySlugParam(slugOrPath);

  return unstable_cache(
    () => loadCategoryFiltersForPath(slugOrPath),
    ["category-filters", normalized],
    {
      revalidate: CATEGORY_FILTERS_REVALIDATE_SECONDS,
      tags: categoryListingRevalidateTags(category.id, slugOrPath)
    }
  )();
}

async function loadCategoryProductsForPath(
  slugOrPath: string,
  filterParams: Record<string, string | string[] | undefined>
): Promise<CategoryProductsListingResult | CategoryListingError | null> {
  const category = await resolveCategoryCached(slugOrPath);
  if (!category) return null;

  const supabase = createSupabaseServiceClient();
  return getCategoryProductsListing(
    supabase,
    category,
    filterParamsToSearchParams(filterParams)
  );
}

export async function getCategoryProductsForPath(
  slugOrPath: string,
  filterParams: Record<string, string | string[] | undefined>
): Promise<CategoryProductsListingResult | CategoryListingError | null> {
  const category = await resolveCategoryCached(slugOrPath);
  if (!category) return null;

  const page = Math.max(1, parseInt(String(filterParams.page ?? "1"), 10) || 1);
  const cacheKey = buildCategoryListingCacheKey(slugOrPath, page, filterParams);

  return unstable_cache(
    () => loadCategoryProductsForPath(slugOrPath, filterParams),
    ["category-listing", cacheKey],
    {
      revalidate: CATEGORY_LISTING_REVALIDATE_SECONDS,
      tags: categoryListingRevalidateTags(category.id, slugOrPath)
    }
  )();
}

async function loadCategoryPageData(
  categoryPath: string,
  page: number,
  filterParams: Record<string, string | string[] | undefined>
): Promise<CategoryPageData | CategoryListingError | null> {
  const category = await resolveCategoryCached(categoryPath);
  if (!category) return null;

  const supabase = createSupabaseServiceClient();

  const searchParams = filterParamsToSearchParams(filterParams);
  if (page > 1) {
    searchParams.set("page", String(page));
  } else {
    searchParams.delete("page");
  }

  const [filtersResult, listingResult] = await Promise.all([
    getCategoryFiltersForPath(categoryPath),
    getCategoryProductsListing(supabase, category, searchParams)
  ]);

  if (!filtersResult || "error" in filtersResult) {
    return { error: filtersResult?.error ?? "Category filters unavailable", status: 500 };
  }
  if ("error" in listingResult) {
    return listingResult;
  }

  return {
    category,
    filters: filtersResult,
    listing: listingResult
  };
}

/** Full category page payload (facets + grid). Cached 60s per URL (path + filters + page). */
export async function getCategoryPageData(
  categoryPath: string,
  page: number,
  filterParams: Record<string, string | string[] | undefined>
): Promise<CategoryPageData | CategoryListingError | null> {
  const category = await resolveCategoryCached(categoryPath);
  if (!category) return null;

  const cacheKey = buildCategoryListingCacheKey(categoryPath, page, filterParams);

  return unstable_cache(
    () => loadCategoryPageData(categoryPath, page, filterParams),
    ["category-page-data", cacheKey],
    {
      revalidate: CATEGORY_LISTING_REVALIDATE_SECONDS,
      tags: categoryListingRevalidateTags(category.id, categoryPath)
    }
  )();
}
