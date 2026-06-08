import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { parsePaginationParams } from "lib/admin/pagination";
import { listAdminProducts } from "lib/admin/products-list";

function parseProductsListParams(searchParams: URLSearchParams) {
  const pagination = parsePaginationParams(searchParams);
  const priceMinRaw = searchParams.get("priceMin");
  const priceMaxRaw = searchParams.get("priceMax");
  const priceMin = priceMinRaw != null && priceMinRaw !== "" ? Number(priceMinRaw) : null;
  const priceMax = priceMaxRaw != null && priceMaxRaw !== "" ? Number(priceMaxRaw) : null;

  return {
    ...pagination,
    q: searchParams.get("q") ?? undefined,
    quickFilter: searchParams.get("quickFilter") ?? "all",
    parentCategory: searchParams.get("parentCategory") ?? "all",
    childCategory: searchParams.get("childCategory") ?? "all",
    priceSource: searchParams.get("priceSource") ?? "all",
    published: searchParams.get("published") ?? "all",
    priceMin: Number.isFinite(priceMin) ? priceMin : null,
    priceMax: Number.isFinite(priceMax) ? priceMax : null,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortDir: (searchParams.get("sortDir") === "asc" ? "asc" : "desc") as "asc" | "desc"
  };
}

export async function GET(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const params = parseProductsListParams(new URL(request.url).searchParams);
    const result = await listAdminProducts(supabase, params);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/products]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
