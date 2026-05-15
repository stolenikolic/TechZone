import { NextResponse } from "next/server";
import { assertAttributeOnCategory } from "lib/attributes/category-attribute-guard";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

type PatchBody = {
  alias?: string;
  canonicalLabel?: string;
  matchMode?: "exact" | "contains" | "regex";
  supplierId?: string | null;
  priority?: number;
  isActive?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; attributeId: string; aliasId: string }> }
) {
  try {
    const { id: categoryId, attributeId, aliasId } = await context.params;
    const body = (await request.json()) as PatchBody;
    const supabase = createSupabaseServiceClient();
    if (!(await assertAttributeOnCategory(supabase, categoryId, attributeId))) {
      return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.alias != null) patch.alias = body.alias.trim();
    if (body.canonicalLabel != null) patch.canonical_label = body.canonicalLabel.trim();
    if (body.matchMode != null) patch.match_mode = body.matchMode;
    if ("supplierId" in body) patch.supplier_id = body.supplierId?.trim() || null;
    if (body.priority != null) patch.priority = body.priority;
    if (body.isActive != null) patch.is_active = body.isActive;

    const { error } = await supabase
      .from("attribute_value_aliases")
      .update(patch)
      .eq("id", aliasId)
      .eq("attribute_id", attributeId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; attributeId: string; aliasId: string }> }
) {
  try {
    const { id: categoryId, attributeId, aliasId } = await context.params;
    const supabase = createSupabaseServiceClient();
    if (!(await assertAttributeOnCategory(supabase, categoryId, attributeId))) {
      return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
    }

    const { error } = await supabase
      .from("attribute_value_aliases")
      .delete()
      .eq("id", aliasId)
      .eq("attribute_id", attributeId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
