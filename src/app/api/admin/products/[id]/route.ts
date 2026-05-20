import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type PatchBody = {
  selling_margin_override?: number | null;
  /** When true, product is hidden on the shop (import may still update is_active). */
  publishLocked?: boolean;
};

/** PATCH /api/admin/products/:id */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;

    const hasMargin = "selling_margin_override" in body;
    const hasPublish = "publishLocked" in body;

    if (!hasMargin && !hasPublish) {
      return NextResponse.json(
        { error: "Provide selling_margin_override and/or publishLocked." },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {};

    if (hasMargin) {
      const v = body.selling_margin_override;
      if (v != null && (!(typeof v === "number") || !Number.isFinite(v) || v <= 0)) {
        return NextResponse.json({ error: "selling_margin_override must be null or a positive number." }, { status: 400 });
      }
      patch.selling_margin_override = v ?? null;
    }

    if (hasPublish) {
      patch.publish_locked = Boolean(body.publishLocked);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("id, is_active, publish_locked")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const row = data as { is_active: boolean; publish_locked: boolean };
    return NextResponse.json({
      success: true,
      isActive: Boolean(row.is_active),
      publishLocked: Boolean(row.publish_locked),
      published: Boolean(row.is_active) && !row.publish_locked
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
