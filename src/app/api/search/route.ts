import { NextResponse } from "next/server";
import { getEffectivePrice } from "lib/effective-price";
import { getSearchTokens } from "lib/search/product-search-tokens";
import { runSearchListing } from "lib/search/search-listing";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import { createSupabaseServiceClient } from "utils/supabase";

export type SearchResultItem = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
  category_id?: string | null;
  topPick?: boolean;
  topPickLabel?: string;
};

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export type SearchResponse = {
  products: SearchResultItem[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  categoryFacets: SearchCategoryFacet[];
  priceRange?: { min: number; max: number };
  filters: Array<{ slug: string; name: string; values: string[] }>;
};

/**
 * GET /api/search?q=...&page=...&category=...&brands=...&prices=min-max&sort=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const pageParam = searchParams.get("page");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: 1,
        categoryFacets: [],
        filters: [],
        error: "Query must be at least 2 characters"
      },
      { status: 400 }
    );
  }

  const safeQuery = q.slice(0, MAX_QUERY_LENGTH);
  const tokens = getSearchTokens(safeQuery);

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: 1,
        categoryFacets: [],
        filters: [],
        error: "Query must contain searchable text"
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServiceClient();
    const listing = await runSearchListing(supabase, tokens, {
      q: safeQuery,
      page,
      sort: searchParams.get("sort"),
      prices: searchParams.get("prices"),
      brands: searchParams.get("brands"),
      category: searchParams.get("category")
    });

    const productRows = listing.products.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      slug: row.slug,
      main_image: row.main_image,
      price: getEffectivePrice(row.custom_price, row.price),
      categoryId: row.category_id
    }));

    const byCategory = new Map<string, string[]>();
    productRows.forEach((row) => {
      if (!row.categoryId) return;
      const list = byCategory.get(row.categoryId) ?? [];
      list.push(row.id);
      byCategory.set(row.categoryId, list);
    });

    const topPickByProductId = new Set<string>();
    for (const [categoryId, ids] of Array.from(byCategory.entries())) {
      const { data: picks } = await supabase
        .from("category_featured_products")
        .select("product_id")
        .eq("category_id", categoryId)
        .in("product_id", ids);
      (picks ?? []).forEach((pick) => topPickByProductId.add(pick.product_id));
    }

    const products: SearchResultItem[] = productRows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      slug: row.slug,
      main_image: row.main_image,
      price: row.price,
      category_id: row.categoryId,
      ...(topPickByProductId.has(row.id) && { topPick: true, topPickLabel: "Top pick" })
    }));

    return NextResponse.json({
      products,
      totalResults: listing.totalResults,
      totalPages: listing.totalPages,
      currentPage: listing.currentPage,
      categoryFacets: listing.filters.categoryFacets,
      priceRange: listing.filters.priceRange,
      filters: listing.filters.filters
    } satisfies SearchResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search]", message);
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: page,
        categoryFacets: [],
        filters: [],
        error: "Search failed"
      },
      { status: 500 }
    );
  }
}
