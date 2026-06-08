import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { getProductsFilterOptions } from "lib/admin/products-list";

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const options = await getProductsFilterOptions(supabase);
    return NextResponse.json(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/products/filter-options]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
