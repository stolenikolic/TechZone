import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  selling_margin_default: number | null;
  created_at: string;
};

type AttributeRow = {
  id: string;
  name: string;
  slug: string;
  filter_display_type: string | null;
  filter_unit: string | null;
  filter_step: number | null;
};

type CategoryAttributeRow = {
  attribute_id: string;
  sort_order: number;
  attributes:
    | {
        id: string;
        name: string;
        slug: string;
        filter_display_type: string | null;
        filter_unit: string | null;
        filter_step: number | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        filter_display_type: string | null;
        filter_unit: string | null;
        filter_step: number | null;
      }[]
    | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { slug } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data: category, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url, selling_margin_default, created_at")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    const [{ data: categories }, { data: attributes }, { data: categoryAttrs }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, parent_id, image_url, selling_margin_default, created_at")
        .order("name", { ascending: true }),
      supabase
        .from("attributes")
        .select("id, name, slug, filter_display_type, filter_unit, filter_step")
        .order("name", { ascending: true }),
      supabase
        .from("category_attributes")
        .select(
          "attribute_id, sort_order, attributes(id, name, slug, filter_display_type, filter_unit, filter_step)"
        )
        .eq("category_id", category.id)
        .order("sort_order", { ascending: true })
    ]);

    const selectedAttributeIds = (categoryAttrs ?? [])
      .map((row) => row.attribute_id)
      .filter((value): value is string => typeof value === "string");
    const categoryAttributes = ((categoryAttrs ?? []) as CategoryAttributeRow[])
      .map((row) => {
        const raw = row.attributes;
        const attribute = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
        if (!attribute) return null;
        return {
          id: attribute.id,
          name: attribute.name,
          slug: attribute.slug,
          filter_display_type: attribute.filter_display_type,
          filter_unit: attribute.filter_unit,
          filter_step: attribute.filter_step,
          sort_order: row.sort_order ?? 0
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return NextResponse.json({
      category: category as CategoryRow,
      categories: (categories ?? []) as CategoryRow[],
      attributes: (attributes ?? []) as AttributeRow[],
      selectedAttributeIds,
      categoryAttributes
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
