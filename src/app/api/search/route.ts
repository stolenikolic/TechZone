import { NextResponse } from "next/server";
import { resolveSearchResults, type SearchApiData } from "lib/search/resolve-search-results";

export type { SearchResultItem } from "lib/search/resolve-search-results";
export type SearchResponse = SearchApiData & { error?: string };

/**
 * GET /api/search?q=...&page=...&category=...&brands=...&prices=min-max&sort=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await resolveSearchResults({
    q: searchParams.get("q"),
    page: searchParams.get("page"),
    sort: searchParams.get("sort"),
    prices: searchParams.get("prices"),
    brands: searchParams.get("brands"),
    category: searchParams.get("category")
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: result.page,
        categoryFacets: [],
        filters: [],
        error: result.error
      } satisfies SearchResponse,
      { status: result.status }
    );
  }

  return NextResponse.json(result.data satisfies SearchApiData);
}
