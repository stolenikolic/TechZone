import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export type SearchResultItem = {
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  main_image: string | null;
  price: number | null;
};

const PER_PAGE = 30;
const MAX_QUERY_LENGTH = 200;
const MIN_QUERY_LENGTH = 2;

export type SearchResponse = {
  products: SearchResultItem[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
};

/**
 * GET /api/search?q=...&page=...
 *
 * Strict product search: only name and brand (no description, no fuzzy logic).
 * - Matches: name ILIKE '%query%' OR brand ILIKE '%query%'. Case-insensitive.
 * - 30 products per page, is_active = true only.
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
        error: "Query must be at least 2 characters"
      },
      { status: 400 }
    );
  }

  const safeQuery = q.slice(0, MAX_QUERY_LENGTH);

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("search_products", {
      search_query: safeQuery,
      page
    });

    if (error) {
      console.error("[search] RPC error:", error.message);
      return NextResponse.json(
        {
          products: [],
          totalResults: 0,
          totalPages: 0,
          currentPage: page,
          error: "Search failed"
        },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as Array<Record<string, unknown> & { total_count?: number }>;
    const totalResults = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
    const totalPages = Math.max(1, Math.ceil(totalResults / PER_PAGE));
    const currentPage = Math.min(page, totalPages);

    const products: SearchResultItem[] = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      brand: row.brand != null ? String(row.brand) : null,
      slug: String(row.slug ?? ""),
      main_image: row.main_image != null ? String(row.main_image) : null,
      price: row.price != null ? Number(row.price) : null
    }));

    const response: SearchResponse = {
      products,
      totalResults,
      totalPages,
      currentPage
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search]", message);
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: page,
        error: "Search failed"
      },
      { status: 500 }
    );
  }
}
