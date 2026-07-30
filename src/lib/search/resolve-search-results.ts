import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilterItem } from "models/Filters";
import { mapProductPriceFields } from "lib/effective-price";
import { getSearchTokens } from "lib/search/product-search-tokens";
import { runSearchListing } from "lib/search/search-listing";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import { createSupabaseServiceClient } from "utils/supabase";

/** Data Cache TTL for a given search query+filters combo (shared by API route + RSC). */
const SEARCH_RESULTS_REVALIDATE_SECONDS = 60;

/** Tag used by admin edit routes to bust cached search results on demand. */
export const SEARCH_RESULTS_CACHE_TAG = "search-results";

export type SearchResultItem = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
  originalPrice?: number;
  category_id?: string | null;
  topPick?: boolean;
  topPickLabel?: string;
};

export type SearchApiData = {
  products: SearchResultItem[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  categoryFacets: SearchCategoryFacet[];
  priceRange?: { min: number; max: number };
  filters: FilterItem[];
};

export type SearchQueryParams = {
  q: string | null | undefined;
  page?: string | number | null;
  sort?: string | null;
  prices?: string | null;
  brands?: string | null;
  category?: string | null;
};

export type SearchResolution =
  | { ok: true; data: SearchApiData }
  | { ok: false; status: number; error: string; page: number };

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

/** Single batched lookup instead of one round trip per distinct category. */
async function loadTopPickIdsForRows(
  supabase: SupabaseClient,
  rows: Array<{ id: string; categoryId: string | null }>
): Promise<Set<string>> {
  const expectedCategoryByProduct = new Map<string, string>();
  rows.forEach((row) => {
    if (row.categoryId) expectedCategoryByProduct.set(row.id, row.categoryId);
  });

  const topPickIds = new Set<string>();
  if (expectedCategoryByProduct.size === 0) return topPickIds;

  const { data } = await supabase
    .from("category_featured_products")
    .select("product_id, category_id")
    .in("category_id", Array.from(new Set(expectedCategoryByProduct.values())))
    .in("product_id", Array.from(expectedCategoryByProduct.keys()));

  (data ?? []).forEach((row) => {
    if (expectedCategoryByProduct.get(row.product_id) !== row.category_id) return;
    topPickIds.add(row.product_id);
  });

  return topPickIds;
}

/**
 * Core search-results resolution, shared by the `/api/search` route handler and the
 * server-rendered search page — so the RSC render calls this in-process instead of
 * doing a self HTTP fetch to its own API route (an unnecessary extra network hop,
 * costly when the app server and DB are in different regions).
 */
async function resolveSearchResultsUncached(params: SearchQueryParams): Promise<SearchResolution> {
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);

  if (q.length < MIN_QUERY_LENGTH) {
    return { ok: false, status: 400, error: "Query must be at least 2 characters", page: 1 };
  }

  const safeQuery = q.slice(0, MAX_QUERY_LENGTH);
  const tokens = getSearchTokens(safeQuery);

  if (tokens.length === 0) {
    return { ok: false, status: 400, error: "Query must contain searchable text", page: 1 };
  }

  try {
    const supabase = createSupabaseServiceClient();
    const listing = await runSearchListing(supabase, tokens, {
      q: safeQuery,
      page,
      sort: params.sort ?? null,
      prices: params.prices ?? null,
      brands: params.brands ?? null,
      category: params.category ?? null
    });

    const productRows = listing.products.map((row) => {
      const { price, originalPrice } = mapProductPriceFields(row);
      return {
        id: row.id,
        name: row.name,
        brand: row.brand,
        slug: row.slug,
        main_image: row.main_image,
        price,
        originalPrice,
        categoryId: row.category_id
      };
    });

    const topPickIds = await loadTopPickIdsForRows(
      supabase,
      productRows.map((row) => ({ id: row.id, categoryId: row.categoryId }))
    );

    const products: SearchResultItem[] = productRows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      slug: row.slug,
      main_image: row.main_image,
      price: row.price,
      ...(row.originalPrice != null && { originalPrice: row.originalPrice }),
      category_id: row.categoryId,
      ...(topPickIds.has(row.id) && { topPick: true, topPickLabel: "Top pick" })
    }));

    return {
      ok: true,
      data: {
        products,
        totalResults: listing.totalResults,
        totalPages: listing.totalPages,
        currentPage: listing.currentPage,
        categoryFacets: listing.filters.categoryFacets,
        priceRange: listing.filters.priceRange,
        filters: listing.filters.filters
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search]", message);
    return { ok: false, status: 500, error: "Search failed", page };
  }
}

/**
 * Cached entry point — both the API route and the RSC search page call this, so a
 * repeated identical search (same query + filters + page) within the revalidate
 * window is served from the Next.js Data Cache instead of re-querying Supabase.
 */
export const resolveSearchResults = unstable_cache(
  resolveSearchResultsUncached,
  ["search-results"],
  { revalidate: SEARCH_RESULTS_REVALIDATE_SECONDS, tags: [SEARCH_RESULTS_CACHE_TAG] }
);
