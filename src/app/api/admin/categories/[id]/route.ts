import { NextResponse } from "next/server";
import { processCategoryImageFromUrl } from "lib/images/process-category-image";
import { isHostedCategoryImage, removeCategoryImage } from "lib/images/storage";
import { normalizeCategorySlug } from "lib/normalize-slug";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url, selling_margin_default, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  name?: string;
  slug?: string;
  parentId?: string | null;
  imageUrl?: string | null;
  sellingMarginDefault?: number | null;
  selling_margin_default?: number | null;
  attributeIds?: string[];
};

/** PATCH /api/admin/categories/:id */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const patch: Record<string, unknown> = {};

    if ("name" in body) {
      const name = body.name?.trim() ?? "";
      if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
      patch.name = name;
    }
    if ("slug" in body) {
      const slug = normalizeCategorySlug(body.slug ?? "");
      if (!slug) return NextResponse.json({ error: "Slug is required." }, { status: 400 });
      patch.slug = slug;
    }
    if ("parentId" in body) patch.parent_id = body.parentId ?? null;

    const supabase = createSupabaseServiceClient();

    if ("imageUrl" in body) {
      const { data: currentCategory } = await supabase
        .from("categories")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();

      const raw = body.imageUrl?.trim() || null;
      if (!raw) {
        await removeCategoryImage(supabase, id, currentCategory?.image_url ?? null);
        patch.image_url = null;
      } else if (isHostedCategoryImage(raw, id)) {
        patch.image_url = raw;
      } else {
        patch.image_url = await processCategoryImageFromUrl(
          supabase,
          id,
          raw,
          currentCategory?.image_url ?? null
        );
      }
    }

    const marginValue =
      "sellingMarginDefault" in body ? body.sellingMarginDefault : body.selling_margin_default;
    if (
      marginValue != null &&
      (!(typeof marginValue === "number") || !Number.isFinite(marginValue) || marginValue <= 0)
    ) {
      return NextResponse.json(
        { error: "selling_margin_default must be null or a positive number." },
        { status: 400 }
      );
    }
    if ("sellingMarginDefault" in body || "selling_margin_default" in body) {
      patch.selling_margin_default = marginValue ?? null;
    }

    const { data: currentCategory } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("categories").update(patch).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if ("attributeIds" in body && Array.isArray(body.attributeIds)) {
      const attributeIds = Array.from(
        new Set(body.attributeIds.filter((value) => typeof value === "string"))
      );
      const { error: delErr } = await supabase
        .from("category_attributes")
        .delete()
        .eq("category_id", id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
      if (attributeIds.length > 0) {
        const rows = attributeIds.map((attributeId) => ({
          category_id: id,
          attribute_id: attributeId
        }));
        const { error: insErr } = await supabase.from("category_attributes").insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    revalidateCategorySurfaces((patch.slug as string | undefined) ?? currentCategory?.slug ?? null);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("category_id", id)
      .limit(1);
    if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
    if (products && products.length > 0) {
      return NextResponse.json(
        { error: "Category has products and cannot be deleted." },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    revalidateCategorySurfaces(categoryRow?.slug ?? null);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
