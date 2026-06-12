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

type CategoryAiConfigRow = {
  tone: string | null;
  audience: string | null;
  extra_instructions: string | null;
  is_enabled: boolean;
};

type CategoryAttributeRow = {
  attribute_id: string;
  sort_order: number;
  include_in_ai_description: boolean;
  ai_description_priority: number;
  attributes:
    | {
        id: string;
        name: string;
        slug: string;
        filter_display_type: string | null;
        filter_unit: string | null;
        filter_step: number | null;
        name_bs: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        filter_display_type: string | null;
        filter_unit: string | null;
        filter_step: number | null;
        name_bs: string | null;
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

    const [{ data: categories }, { data: attributes }, { data: categoryAttrs }, { data: aiConfig }] =
      await Promise.all([
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
          "attribute_id, sort_order, include_in_ai_description, ai_description_priority, attributes(id, name, slug, name_bs, filter_display_type, filter_unit, filter_step)"
        )
        .eq("category_id", category.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("category_ai_description_config")
        .select("tone, audience, extra_instructions, is_enabled")
        .eq("category_id", category.id)
        .maybeSingle()
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
          name_bs: attribute.name_bs ?? null,
          sort_order: row.sort_order ?? 0,
          include_in_ai_description: Boolean(row.include_in_ai_description),
          ai_description_priority: row.ai_description_priority ?? 100
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return NextResponse.json({
      category: category as CategoryRow,
      categories: (categories ?? []) as CategoryRow[],
      attributes: (attributes ?? []) as AttributeRow[],
      selectedAttributeIds,
      categoryAttributes,
      aiDescriptionConfig: aiConfig
        ? {
            tone: (aiConfig as CategoryAiConfigRow).tone,
            audience: (aiConfig as CategoryAiConfigRow).audience,
            extraInstructions: (aiConfig as CategoryAiConfigRow).extra_instructions,
            isEnabled: (aiConfig as CategoryAiConfigRow).is_enabled
          }
        : null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
