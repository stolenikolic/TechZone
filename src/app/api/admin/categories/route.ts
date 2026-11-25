import { NextResponse } from "next/server";
import { processCategoryImageFromUrl } from "lib/images/process-category-image";
import { isHostedCategoryImage } from "lib/images/storage";
import { normalizeCategorySlug } from "lib/normalize-slug";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import {
  categoryParentChildError,
  readCategoryViewInput,
  resolveCategoryViewWrite
} from "lib/shop/category-view-admin";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  selling_margin_default: number | null;
  sort_order: number;
  created_at: string;
};

/** Missing or non-integer sort order means "put this new category at the end of its siblings". */
function readCreateSortOrder(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return parsed;
}

async function nextSiblingSortOrder(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  parentId: string | null
): Promise<number> {
  let query = supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  query = parentId == null ? query.is("parent_id", null) : query.eq("parent_id", parentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const max = data?.[0]?.sort_order;
  return (typeof max === "number" ? max : 0) + 10;
}

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select(
        "id, name, slug, parent_id, image_url, selling_margin_default, sort_order, created_at, view_source_category_id, view_filter_attribute_slug, view_filter_value"
      )
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
  viewSourceCategoryId?: string | null;
  viewFilterAttributeSlug?: string | null;
  viewFilterValue?: string | null;
  sortOrder?: number | null;
};

export async function POST(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as CreateBody;
    const name = body.name?.trim() ?? "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const slug = normalizeCategorySlug(body.slug && body.slug.trim().length > 0 ? body.slug : name);
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
    const parentError = await categoryParentChildError(supabase, parentId);
    if (parentError) return NextResponse.json({ error: parentError }, { status: 400 });

    const viewInput = readCategoryViewInput(body);
    const resolvedView = viewInput.present
      ? await resolveCategoryViewWrite(supabase, null, viewInput.input)
      : {
          ok: true as const,
          columns: {
            view_source_category_id: null,
            view_filter_attribute_slug: null,
            view_filter_value: null
          }
        };
    if (!resolvedView.ok) return NextResponse.json({ error: resolvedView.error }, { status: 400 });

    const requestedSort = readCreateSortOrder(body.sortOrder);
    const sortOrder =
      requestedSort ?? (await nextSiblingSortOrder(supabase, parentId));

    const { data: created, error } = await supabase
      .from("categories")
      .insert({
        name,
        slug,
        parent_id: parentId,
        image_url: imageUrl,
        selling_margin_default: sellingMarginDefault,
        sort_order: sortOrder,
        ...resolvedView.columns
      })
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!created) return NextResponse.json({ error: "Category create failed." }, { status: 500 });

    if (imageUrl && !isHostedCategoryImage(imageUrl, created.id as string)) {
      const processed = await processCategoryImageFromUrl(
        supabase,
        created.id as string,
        imageUrl,
        null
      );
      if (processed) {
        await supabase.from("categories").update({ image_url: processed }).eq("id", created.id);
      }
    }

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
