import { NextResponse } from "next/server";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  selling_margin_default: number | null;
  created_at: string;
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url, selling_margin_default, created_at")
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as CategoryRow[];
    const categoryIds = rows.map((row) => row.id);
    const [{ data: productCounts }, { data: topPickCounts }] = categoryIds.length
      ? await Promise.all([
          supabase
            .from("products")
            .select("category_id")
            .in("category_id", categoryIds)
            .eq("is_active", true),
          supabase
            .from("category_featured_products")
            .select("category_id")
            .in("category_id", categoryIds)
        ])
      : [{ data: [] }, { data: [] }];

    const productCountByCategory = new Map<string, number>();
    (productCounts ?? []).forEach((row) => {
      const categoryId = row.category_id;
      if (!categoryId) return;
      productCountByCategory.set(categoryId, (productCountByCategory.get(categoryId) ?? 0) + 1);
    });
    const topPickCountByCategory = new Map<string, number>();
    (topPickCounts ?? []).forEach((row) => {
      const categoryId = row.category_id;
      if (!categoryId) return;
      topPickCountByCategory.set(categoryId, (topPickCountByCategory.get(categoryId) ?? 0) + 1);
    });

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        productCount: productCountByCategory.get(row.id) ?? 0,
        topPickCount: topPickCountByCategory.get(row.id) ?? 0
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateBody = {
  name?: string;
  slug?: string;
  parentId?: string | null;
  imageUrl?: string | null;
  sellingMarginDefault?: number | null;
  attributeIds?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBody;
    const name = body.name?.trim() ?? "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const slug = normalizeSlug(body.slug && body.slug.trim().length > 0 ? body.slug : name);
    if (!slug) return NextResponse.json({ error: "Slug is required." }, { status: 400 });
    const parentId = body.parentId ?? null;
    const imageUrl = body.imageUrl?.trim() || null;
    const sellingMarginDefault = body.sellingMarginDefault ?? null;
    if (
      sellingMarginDefault != null &&
      (!Number.isFinite(sellingMarginDefault) || sellingMarginDefault <= 0)
    ) {
      return NextResponse.json(
        { error: "sellingMarginDefault must be null or > 0." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data: created, error } = await supabase
      .from("categories")
      .insert({
        name,
        slug,
        parent_id: parentId,
        image_url: imageUrl,
        selling_margin_default: sellingMarginDefault
      })
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!created) return NextResponse.json({ error: "Category create failed." }, { status: 500 });

    const attributeIds = Array.isArray(body.attributeIds)
      ? Array.from(new Set(body.attributeIds.filter((value) => typeof value === "string")))
      : [];
    if (attributeIds.length > 0) {
      const rows = attributeIds.map((attributeId) => ({
        category_id: created.id,
        attribute_id: attributeId
      }));
      const { error: attrErr } = await supabase.from("category_attributes").insert(rows);
      if (attrErr) return NextResponse.json({ error: attrErr.message }, { status: 400 });
    }

    revalidateCategorySurfaces(slug);
    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
