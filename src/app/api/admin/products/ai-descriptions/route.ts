import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "generated";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, name, slug, brand, description, ai_meta_description, ai_title_suggestion,
         ai_og_description, ai_faq, ai_description_status, ai_description_generated_at,
         categories(name, slug)`
      )
      .eq("ai_description_status", status)
      .order("ai_description_generated_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { productId?: string; action?: "approve" };
    const productId = body.productId?.trim();
    if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });
    if (body.action !== "approve") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("products")
      .update({
        ai_description_status: "approved",
        updated_at: new Date().toISOString()
      })
      .eq("id", productId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
