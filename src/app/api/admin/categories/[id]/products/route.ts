import { NextResponse } from "next/server";
import { compareTopPickThenDate, type CategoryTopPick } from "lib/category-top-picks";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

const PAGE_SIZE = 30;

const PRODUCT_SELECT =
  "id, name, slug, brand, main_image, price, custom_price, created_at" as const;

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  created_at: string | null;
};

function toAdminProduct(
  row: ProductRow,
  topPickMap: Map<string, CategoryTopPick>
) {
  const pick = topPickMap.get(row.id);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    image: row.main_image ?? "/assets/images/placeholder.png",
    price: row.custom_price ?? row.price ?? 0,
    highlighted: Boolean(pick),
    priority: pick?.priority ?? null
  };
}

type TopPickBody = {
  productId?: string;
  highlighted?: boolean;
  priority?: number;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const q = (searchParams.get("q") ?? "").trim();

    const supabase = createSupabaseServiceClient();

    const { data: picksRows } = await supabase
      .from("category_featured_products")
      .select("product_id, priority, created_at")
      .eq("category_id", categoryId);

    const topPickMap = new Map<string, CategoryTopPick>(
      (picksRows ?? []).map((pick) => [
        pick.product_id,
        {
          productId: pick.product_id,
          priority: pick.priority ?? 100,
          createdAt: pick.created_at ?? ""
        }
      ])
    );
    const pickIds = Array.from(topPickMap.keys());

    let featuredRows: ProductRow[] = [];
    if (pickIds.length > 0) {
      let featuredQuery = supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .in("id", pickIds);
      if (q) featuredQuery = featuredQuery.ilike("name", `%${q}%`);
      const { data, error: featuredError } = await featuredQuery;
      if (featuredError) return NextResponse.json({ error: featuredError.message }, { status: 400 });
      featuredRows = (data ?? []) as ProductRow[];
      featuredRows.sort((a, b) =>
        compareTopPickThenDate(a.id, b.id, a.created_at, b.created_at, topPickMap)
      );
    }

    let nonFeaturedQuery = supabase
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" })
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (q) nonFeaturedQuery = nonFeaturedQuery.ilike("name", `%${q}%`);
    if (pickIds.length > 0) nonFeaturedQuery = nonFeaturedQuery.not("id", "in", `(${pickIds.join(",")})`);

    const nonFeaturedOffset = page === 1 ? 0 : (page - 1) * PAGE_SIZE;
    const { data: nonFeaturedRows, error, count: nonFeaturedCount } = await nonFeaturedQuery.range(
      nonFeaturedOffset,
      nonFeaturedOffset + PAGE_SIZE - 1
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const combinedRows =
      page === 1
        ? [...featuredRows, ...((nonFeaturedRows ?? []) as ProductRow[])]
        : ((nonFeaturedRows ?? []) as ProductRow[]);

    const products = combinedRows.map((row) => toAdminProduct(row, topPickMap));
    const total = featuredRows.length + (nonFeaturedCount ?? 0);

    return NextResponse.json({
      products,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const body = (await request.json()) as TopPickBody;
    const productId = body.productId;
    if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });
    const highlighted = Boolean(body.highlighted);
    const priority = body.priority ?? 100;
    if (!Number.isFinite(priority) || priority < 0) {
      return NextResponse.json({ error: "priority must be >= 0." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    if (!highlighted) {
      const { error } = await supabase
        .from("category_featured_products")
        .delete()
        .eq("category_id", categoryId)
        .eq("product_id", productId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      revalidateCategorySurfaces(categoryRow?.slug ?? null, categoryId);
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.from("category_featured_products").upsert(
      {
        category_id: categoryId,
        product_id: productId,
        priority,
        updated_at: new Date().toISOString()
      },
      { onConflict: "category_id,product_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    revalidateCategorySurfaces(categoryRow?.slug ?? null, categoryId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
