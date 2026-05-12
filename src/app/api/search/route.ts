import { NextResponse } from "next/server";
import { getEffectivePrice } from "lib/effective-price";
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

const PER_PAGE = 30;
const MAX_QUERY_LENGTH = 200;
const MIN_QUERY_LENGTH = 2;
const SEARCH_COLUMNS = ["name", "brand", "mpn", "ean"] as const;

export type SearchResponse = {
  products: SearchResultItem[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
};

function getSearchTokens(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[%,()]/g, "").trim())
    .filter(Boolean);
}

function buildTokenFilter(token: string) {
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.%${token}%`).join(",");
}

/**
 * GET /api/search?q=...&page=...
 *
 * Token product search across name, brand, MPN, and EAN (no description, no fuzzy logic).
 * - Every query token must match somewhere in the product identity fields.
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
  const tokens = getSearchTokens(safeQuery);

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        products: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: 1,
        error: "Query must contain searchable text"
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServiceClient();
    const from = (page - 1) * PER_PAGE;
    const to = from + PER_PAGE - 1;

    let query = supabase
      .from("products")
      .select("id,name,brand,slug,main_image,price,custom_price,category_id,created_at", {
        count: "exact"
      })
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(from, to);

    for (const token of tokens) {
      query = query.or(buildTokenFilter(token));
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[search] query error:", error.message);
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

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const totalResults = Number(count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalResults / PER_PAGE));
    const currentPage = Math.min(page, totalPages);

    const productRows = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      brand: row.brand != null ? String(row.brand) : null,
      slug: String(row.slug ?? ""),
      main_image: row.main_image != null ? String(row.main_image) : null,
      price: getEffectivePrice(row.custom_price, row.price),
      categoryId: row.category_id != null ? String(row.category_id) : null,
      createdAt: row.created_at != null ? String(row.created_at) : null
    }));

    const byCategory = new Map<string, string[]>();
    productRows.forEach((row) => {
      if (!row.categoryId) return;
      const list = byCategory.get(row.categoryId) ?? [];
      list.push(row.id);
      byCategory.set(row.categoryId, list);
    });

    const topPickByProductId = new Map<string, { priority: number; createdAt: string }>();
    for (const [categoryId, ids] of Array.from(byCategory.entries())) {
      const { data: picks } = await supabase
        .from("category_featured_products")
        .select("product_id, priority, created_at")
        .eq("category_id", categoryId)
        .in("product_id", ids);
      (picks ?? []).forEach((pick) => {
        topPickByProductId.set(pick.product_id, {
          priority: pick.priority ?? 100,
          createdAt: pick.created_at ?? ""
        });
      });
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
