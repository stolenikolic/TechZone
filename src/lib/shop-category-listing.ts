import { cache } from "react";
import { unstable_cache } from "next/cache";
import type Product from "models/Product.model";
import type { FilterItem } from "models/Filters";
import { isNotApplicableAttributeValue } from "lib/attributes/not-applicable-value";
import { loadTopPickMapByCategory, type CategoryTopPick } from "lib/category-top-picks";
import { getEffectivePrice, mapProductPriceFields } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";
import { parseNumericFromAttributeValue } from "lib/shop/range-filter-utils";
import {
  fetchShopVisibleProductsForCategory,
  isShopVisibleProduct,
  shopVisibleProductIds,
  type ShopProductRow
} from "lib/shop-category-products";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";

/** Chunk size for product_attributes .in("product_id", ...) — keep in sync across listing + facets. */
export const PRODUCT_ATTRIBUTES_CHUNK_SIZE = 50;

/** Page size when loading product_attributes for facet building (must paginate; no row cap). */
const PRODUCT_ATTRIBUTES_FACET_PAGE_SIZE = 1000;

const LISTING_LIMIT = 30;
const RESERVED_PARAMS = new Set(["page", "prices", "sort"]);

/** Next.js Data Cache TTL for category listing, facets, and visible-product pool. */
export const CATEGORY_LISTING_REVALIDATE_SECONDS = 60;

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

export const resolveCategoryBySlugPathCached = cache(async (normalizedPath: string) => {
  const segments = slugParamToSegments(normalizedPath);
  if (!segments.length) return null;
  const supabase = createSupabaseServiceClient();
  return resolveCategoryBySlugPath(supabase, segments);
});

function resolveCategoryCached(slugOrPath: string) {
  return resolveCategoryBySlugPathCached(normalizeCategorySlugParam(slugOrPath));
}

async function loadVisibleProductsForCategory(categoryId: string): Promise<ShopProductRow[]> {
  return unstable_cache(
    async () => {
      const supabase = createSupabaseServiceClient();
      return fetchShopVisibleProductsForCategory(supabase, categoryId);
    },
    ["shop-visible-products", categoryId],
    {
      revalidate: CATEGORY_LISTING_REVALIDATE_SECONDS,
      tags: [categoryListingTagForId(categoryId)]
    }
  )();
}

/** Per-request dedupe + 60s Data Cache for the category product pool (facets + listing). */
export const getVisibleProductsForCategoryCached = cache(loadVisibleProductsForCategory);

type ProductAttributeFacetRow = { value: string | null; attribute_id: string };

/** Load all product_attributes rows for facet building (paginated; avoids silent .limit truncation). */
async function fetchProductAttributeFacetRows(
  supabase: SupabaseClient,
  productIds: string[],
  attributeIds: string[]
): Promise<ProductAttributeFacetRow[]> {
  if (productIds.length === 0 || attributeIds.length === 0) return [];

  const rows: ProductAttributeFacetRow[] = [];

  for (let i = 0; i < productIds.length; i += PRODUCT_ATTRIBUTES_CHUNK_SIZE) {
    const pidChunk = productIds.slice(i, i + PRODUCT_ATTRIBUTES_CHUNK_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("product_attributes")
        .select("value, attribute_id")
        .in("product_id", pidChunk)
        .in("attribute_id", attributeIds)
        .order("product_id", { ascending: true })
        .order("attribute_id", { ascending: true })
        .range(offset, offset + PRODUCT_ATTRIBUTES_FACET_PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      const page = (data ?? []) as ProductAttributeFacetRow[];
      if (page.length === 0) break;

      rows.push(...page);
      if (page.length < PRODUCT_ATTRIBUTES_FACET_PAGE_SIZE) break;
      offset += PRODUCT_ATTRIBUTES_FACET_PAGE_SIZE;
    }
  }

  return rows;
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
  category: CategoryPayload,
  visibleProducts: ShopProductRow[]
): Promise<CategoryFiltersResponse | { error: string }> {
  const result: CategoryFiltersResponse = { filters: [] };

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
    return result;
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

  const paRows = await fetchProductAttributeFacetRows(supabase, productIds, orderedAttrIds);
  for (const row of paRows) {
    if (row.value == null || String(row.value).trim() === "") continue;
    if (isNotApplicableAttributeValue(String(row.value))) continue;
    if (!attributeMeta.has(row.attribute_id)) continue;
    if (!byAttributeId.has(row.attribute_id)) byAttributeId.set(row.attribute_id, new Set());
    byAttributeId.get(row.attribute_id)!.add(String(row.value).trim());
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

function timestampOrZero(iso: string | null | undefined): number {
  if (iso == null || iso === "") return 0;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? 0 : t;
}

function compareProductsBySort(a: DbProduct, b: DbProduct, sort: SortMode): number {
  const nameCmp = String(a.name ?? "").localeCompare(String(b.name ?? ""));
  const aEff = getEffectivePrice(a.custom_price, a.price);
  const bEff = getEffectivePrice(b.custom_price, b.price);

  switch (sort) {
    case "asc": {
      const aBad = !Number.isFinite(aEff);
      const bBad = !Number.isFinite(bEff);
      if (aBad && bBad) return nameCmp;
      if (aBad) return 1;
      if (bBad) return -1;
      const diff = aEff - bEff;
      return diff !== 0 ? diff : nameCmp;
    }
    case "desc": {
      const aBad = !Number.isFinite(aEff);
      const bBad = !Number.isFinite(bEff);
      if (aBad && bBad) return nameCmp;
      if (aBad) return 1;
      if (bBad) return -1;
      const diff = bEff - aEff;
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

function compareCategoryListingRows(
  a: DbProduct,
  b: DbProduct,
  sortMode: SortMode,
  topPickMap: Map<string, CategoryTopPick>
): number {
  const aFeatured = topPickMap.has(a.id);
  const bFeatured = topPickMap.has(b.id);
  if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

  const byUser = compareProductsBySort(a, b, sortMode);
  if (byUser !== 0) return byUser;

  if (aFeatured && bFeatured) {
    const pa = topPickMap.get(a.id)?.priority ?? 100;
    const pb = topPickMap.get(b.id)?.priority ?? 100;
    if (pa !== pb) return pa - pb;
  }

  return String(a.id).localeCompare(String(b.id));
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
  visibleProducts: ShopProductRow[],
  searchParams: URLSearchParams
): Promise<CategoryProductsListingResult | CategoryListingError> {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const sortMode = parseSortParam(searchParams.get("sort"));
  const prices = parseRangeParam(searchParams.get("prices"));
  const safeNum = (n: unknown): number | undefined =>
    typeof n === "number" && Number.isFinite(n) ? n : undefined;
  const priceMin = safeNum(prices?.[0]);
  const priceMax = safeNum(prices?.[1]);

  const topPickMap = await loadTopPickMapByCategory(category.id);
  const categoryProductIds = shopVisibleProductIds(visibleProducts);

  const { data: caRows } = await supabase
    .from("category_attributes")
    .select("attribute_id")
    .eq("category_id", category.id);
  const categoryAttrIds = Array.from(
    new Set((caRows ?? []).map((r) => r.attribute_id).filter(Boolean))
  ) as string[];

  type AttrMeta = { id: string; slug: string };
  const attributeIdBySlug = new Map<string, string>();
  if (categoryAttrIds.length > 0) {
    const { data: attrRows } = await supabase
      .from("attributes")
      .select("id, slug")
      .in("id", categoryAttrIds);
    (attrRows ?? []).forEach((a: AttrMeta) => {
      if (a.slug) attributeIdBySlug.set(a.slug, a.id);
    });
  }

  const allowedFilterKeys = new Set<string>(["brands", ...Array.from(attributeIdBySlug.keys())]);

  const brands = parseListParam(searchParams.get("brands"));
  let brandFilterNames: string[] | null = null;
  if (brands?.length) {
    const distinctNames = Array.from(
      new Set(visibleProducts.map((r) => r.brand).filter((n): n is string => n != null && n !== ""))
    );
    brandFilterNames = distinctNames.filter((name) =>
      brands.includes(name.toLowerCase().replace(/\s+/g, "-"))
    );
    if (brandFilterNames.length === 0) {
      return { category, products: [], total: 0, page, totalPages: 0 };
    }
  }

  let productIdFilter: string[] | null = null;

  if (categoryProductIds.length === 0) {
    return { category, products: [], total: 0, page, totalPages: 0 };
  }

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
      for (let i = 0; i < categoryProductIds.length; i += PRODUCT_ATTRIBUTES_CHUNK_SIZE) {
        const chunk = categoryProductIds.slice(i, i + PRODUCT_ATTRIBUTES_CHUNK_SIZE);
        const { data: paChunk, error: paError } = await supabase
          .from("product_attributes")
          .select("product_id, value")
          .eq("attribute_id", attrId)
          .in("product_id", chunk);
        if (paError) {
          return { error: "Filter query failed", status: 500 };
        }
        if (paChunk?.length) allPaRows.push(...(paChunk as PaRow[]));
      }

      const matchingIds = new Set<string>();

      if (parsed.type === "list") {
        const normalizedWant = new Set(parsed.values.map((v) => String(v).trim().toLowerCase()));
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
          const num = parseNumericFromAttributeValue(row.value);
          if (num != null) {
            if (num >= rMin && num <= rMax) matchingIds.add(row.product_id);
          } else {
            const asInt = parseInt(String(row.value), 10);
            if (!Number.isNaN(asInt) && asInt >= rMin && asInt <= rMax) {
              matchingIds.add(row.product_id);
            }
          }
        });
      }

      if (matchingIds.size === 0) {
        return { category, products: [], total: 0, page, totalPages: 0 };
      }
      attributeSets.push(matchingIds);
    }

    if (attributeSets.length > 0) {
      const [first, ...rest] = attributeSets;
      const intersection =
        rest.length === 0 ? first : new Set(Array.from(first).filter((id) => rest.every((s) => s.has(id))));
      productIdFilter = Array.from(intersection);
      if (productIdFilter.length === 0) {
        return { category, products: [], total: 0, page, totalPages: 0 };
      }
    }
  }

  const candidateRows: DbProduct[] = [];

  if (productIdFilter?.length) {
    for (let i = 0; i < productIdFilter.length; i += PRODUCT_ATTRIBUTES_CHUNK_SIZE) {
      const chunk = productIdFilter.slice(i, i + PRODUCT_ATTRIBUTES_CHUNK_SIZE);
      let chunkQuery = applyStorefrontProductVisibility(
        supabase
          .from("products")
          .select(
            "id, name, slug, description, brand, main_image, price, custom_price, original_price, created_at, is_active, publish_locked"
          )
          .eq("category_id", category.id)
      ).in("id", chunk);

      if (brandFilterNames?.length) {
        chunkQuery = chunkQuery.in("brand", brandFilterNames);
      }

      const { data: chunkRows, error: chunkError } = await chunkQuery;
      if (chunkError) {
        return { error: chunkError.message, status: 500 };
      }
      candidateRows.push(
        ...((chunkRows ?? []) as Array<DbProduct & { is_active?: boolean; publish_locked?: boolean }>).filter(
          (row) =>
            isShopVisibleProduct({
              id: row.id,
              brand: row.brand,
              price: row.price ?? null,
              custom_price: row.custom_price ?? null,
              is_active: row.is_active ?? true,
              publish_locked: row.publish_locked ?? false
            })
        )
      );
    }
  } else {
    for (let i = 0; i < categoryProductIds.length; i += PRODUCT_ATTRIBUTES_CHUNK_SIZE) {
      const chunk = categoryProductIds.slice(i, i + PRODUCT_ATTRIBUTES_CHUNK_SIZE);
      let pageQuery = applyStorefrontProductVisibility(
        supabase
          .from("products")
          .select(
            "id, name, slug, description, brand, main_image, price, custom_price, original_price, created_at, is_active, publish_locked"
          )
          .eq("category_id", category.id)
      ).in("id", chunk);

      if (brandFilterNames?.length) {
        pageQuery = pageQuery.in("brand", brandFilterNames);
      }

      const { data: pageRows, error: pageError } = await pageQuery;
      if (pageError) {
        return { error: pageError.message, status: 500 };
      }

      const rows = (pageRows ?? []) as Array<DbProduct & { is_active?: boolean; publish_locked?: boolean }>;
      candidateRows.push(
        ...rows.filter((row) =>
          isShopVisibleProduct({
            id: row.id,
            brand: row.brand,
            price: row.price ?? null,
            custom_price: row.custom_price ?? null,
            is_active: row.is_active ?? true,
            publish_locked: row.publish_locked ?? false
          })
        )
      );
    }
  }

  const filteredRows = candidateRows.filter((row) => {
    const effectivePrice = getEffectivePrice(row.custom_price, row.price);
    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return false;
    if (priceMin != null && effectivePrice < priceMin) return false;
    if (priceMax != null && effectivePrice > priceMax) return false;
    return true;
  });

  filteredRows.sort((a, b) => compareCategoryListingRows(a, b, sortMode, topPickMap));

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LISTING_LIMIT));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const pageOffset = (clampedPage - 1) * LISTING_LIMIT;
  const products = filteredRows
    .slice(pageOffset, pageOffset + LISTING_LIMIT)
    .map((row) => toProduct(row, category, topPickMap));

  return {
    category,
    products,
    total: totalCount,
    page: clampedPage,
    totalPages
  };
}

async function loadCategoryFiltersForPath(
  slugOrPath: string
): Promise<CategoryFiltersResponse | { error: string } | null> {
  const category = await resolveCategoryCached(slugOrPath);
  if (!category) return null;

  const supabase = createSupabaseServiceClient();
  const visibleProducts = await getVisibleProductsForCategoryCached(category.id);
  return buildCategoryFiltersPayload(supabase, category, visibleProducts);
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
      revalidate: CATEGORY_LISTING_REVALIDATE_SECONDS,
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
  const visibleProducts = await getVisibleProductsForCategoryCached(category.id);
  return getCategoryProductsListing(
    supabase,
    category,
    visibleProducts,
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
  const visibleProducts = await getVisibleProductsForCategoryCached(category.id);

  const searchParams = filterParamsToSearchParams(filterParams);
  if (page > 1) {
    searchParams.set("page", String(page));
  } else {
    searchParams.delete("page");
  }

  const [filtersResult, listingResult] = await Promise.all([
    buildCategoryFiltersPayload(supabase, category, visibleProducts),
    getCategoryProductsListing(supabase, category, visibleProducts, searchParams)
  ]);

  if ("error" in filtersResult) {
    return { error: filtersResult.error, status: 500 };
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
