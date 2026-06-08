import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { getSupplierOffersStats } from "lib/admin/supplier-products-list";

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const stats = await getSupplierOffersStats(supabase);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/stats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
