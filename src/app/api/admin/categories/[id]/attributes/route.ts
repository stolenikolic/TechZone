import { NextResponse } from "next/server";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type CreateBody = {
  attributeId?: string;
  name?: string;
  slug?: string;
  displayType?: "checkbox" | "range";
  unit?: string | null;
  step?: number | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const body = (await request.json()) as CreateBody;
    const existingAttributeId = body.attributeId?.trim();
    const supabase = createSupabaseServiceClient();

    if (existingAttributeId) {
      const { data: maxRow } = await supabase
        .from("category_attributes")
        .select("sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (maxRow?.sort_order ?? -1) + 1;
      const { error: attachError } = await supabase.from("category_attributes").upsert(
        {
          category_id: categoryId,
          attribute_id: existingAttributeId,
          sort_order: nextSort
        },
        { onConflict: "category_id,attribute_id" }
      );
      if (attachError) return NextResponse.json({ error: attachError.message }, { status: 400 });
      const { data: category } = await supabase
        .from("categories")
        .select("slug")
        .eq("id", categoryId)
        .maybeSingle();
      revalidateCategorySurfaces(category?.slug ?? null);
      return NextResponse.json({ success: true, attributeId: existingAttributeId }, { status: 201 });
    }

    const name = body.name?.trim() ?? "";
    if (!name) return NextResponse.json({ error: "Attribute name is required." }, { status: 400 });
    const slug = normalizeSlug(body.slug && body.slug.trim() ? body.slug : name);
    if (!slug) return NextResponse.json({ error: "Attribute slug is required." }, { status: 400 });
    const displayType = body.displayType === "range" ? "range" : "checkbox";
    const unit = body.unit?.trim() || null;
    const step = body.step ?? null;
    if (displayType === "range" && (step == null || !Number.isFinite(step) || step <= 0)) {
      return NextResponse.json({ error: "Range attribute requires step > 0." }, { status: 400 });
    }

    const { data: created, error: createError } = await supabase
      .from("attributes")
      .insert({
        name,
        slug,
        filter_display_type: displayType,
        filter_unit: unit,
        filter_step: step
      })
      .select("id")
      .maybeSingle();
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });
    if (!created) return NextResponse.json({ error: "Attribute create failed." }, { status: 500 });

    const { data: maxRow } = await supabase
      .from("category_attributes")
      .select("sort_order")
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;

    const { error: attachError } = await supabase.from("category_attributes").insert({
      category_id: categoryId,
      attribute_id: created.id,
      sort_order: nextSort
    });
    if (attachError) return NextResponse.json({ error: attachError.message }, { status: 400 });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);
    return NextResponse.json({ success: true, attributeId: created.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  action?: "update" | "move";
  attributeId?: string;
  name?: string;
  slug?: string;
  displayType?: "checkbox" | "range";
  unit?: string | null;
  step?: number | null;
  direction?: "up" | "down";
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const body = (await request.json()) as PatchBody;
    const attributeId = body.attributeId;
    if (!attributeId) return NextResponse.json({ error: "attributeId is required." }, { status: 400 });
    const action = body.action ?? "update";
    const supabase = createSupabaseServiceClient();

    if (action === "move") {
      const direction = body.direction === "down" ? "down" : "up";
      const { data: rows, error } = await supabase
        .from("category_attributes")
        .select("attribute_id, sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const list = rows ?? [];
      const index = list.findIndex((row) => row.attribute_id === attributeId);
      if (index < 0) return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= list.length) return NextResponse.json({ success: true });

      const current = list[index];
      const target = list[swapIndex];
      const [{ error: updateCurrentError }, { error: updateTargetError }] = await Promise.all([
        supabase
          .from("category_attributes")
          .update({ sort_order: target.sort_order })
          .eq("category_id", categoryId)
          .eq("attribute_id", current.attribute_id),
        supabase
          .from("category_attributes")
          .update({ sort_order: current.sort_order })
          .eq("category_id", categoryId)
          .eq("attribute_id", target.attribute_id)
      ]);
      if (updateCurrentError) return NextResponse.json({ error: updateCurrentError.message }, { status: 400 });
      if (updateTargetError) return NextResponse.json({ error: updateTargetError.message }, { status: 400 });
    } else {
      const patch: Record<string, unknown> = {};
      if ("name" in body && body.name != null) patch.name = body.name.trim();
      if ("slug" in body && body.slug != null) patch.slug = normalizeSlug(body.slug);
      if ("displayType" in body) patch.filter_display_type = body.displayType === "range" ? "range" : "checkbox";
      if ("unit" in body) patch.filter_unit = body.unit?.trim() || null;
      if ("step" in body) patch.filter_step = body.step ?? null;
      if (patch.filter_display_type === "range") {
        const step = patch.filter_step as number | null | undefined;
        if (step == null || !Number.isFinite(step) || step <= 0) {
          return NextResponse.json({ error: "Range attribute requires step > 0." }, { status: 400 });
        }
      }
      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase
          .from("attributes")
          .update(patch)
          .eq("id", attributeId);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

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

type DeleteBody = { attributeId?: string };

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const body = (await request.json()) as DeleteBody;
    const attributeId = body.attributeId;
    if (!attributeId) return NextResponse.json({ error: "attributeId is required." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("category_attributes")
      .delete()
      .eq("category_id", categoryId)
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
