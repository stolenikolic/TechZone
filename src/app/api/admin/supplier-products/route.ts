import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { parsePaginationParams } from "lib/admin/pagination";
import { listSupplierOffers } from "lib/admin/supplier-products-list";

export type { SupplierOfferRow } from "lib/admin/supplier-products-list";

function parseSupplierOffersListParams(searchParams: URLSearchParams) {
  const pagination = parsePaginationParams(searchParams);
  return {
    ...pagination,
    q: searchParams.get("q") ?? undefined,
    supplier: searchParams.get("supplier") ?? "all",
    matchStatus: searchParams.get("matchStatus") ?? "all",
    enrichmentStatus: searchParams.get("enrichmentStatus") ?? "all",
    quickFilter: searchParams.get("quickFilter") ?? "all",
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortDir: (searchParams.get("sortDir") === "asc" ? "asc" : "desc") as "asc" | "desc"
  };
}

export async function GET(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const params = parseSupplierOffersListParams(new URL(request.url).searchParams);
    const result = await listSupplierOffers(supabase, params);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
