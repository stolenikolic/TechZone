import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { getProductsStats } from "lib/admin/products-list";

const getCachedProductsStats = unstable_cache(
  async () => getProductsStats(createSupabaseServiceClient()),
  ["admin-products-stats-v2"],
  { revalidate: 300 }
);

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const stats = await getCachedProductsStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/products/stats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
