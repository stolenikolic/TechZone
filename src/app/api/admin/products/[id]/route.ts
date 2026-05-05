import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/products/:id — body: { selling_margin_override: number | null } */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { selling_margin_override?: number | null };

    if (!("selling_margin_override" in body)) {
      return NextResponse.json({ error: "selling_margin_override is required." }, { status: 400 });
    }

    const v = body.selling_margin_override;
    if (v != null && (!(typeof v === "number") || !Number.isFinite(v) || v <= 0)) {
      return NextResponse.json({ error: "selling_margin_override must be null or a positive number." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("products")
      .update({ selling_margin_override: v ?? null })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
