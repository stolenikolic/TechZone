import { NextResponse } from "next/server";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

const PAGE_SIZE = 30;

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
    const offset = (page - 1) * PAGE_SIZE;

    const supabase = createSupabaseServiceClient();
    let query = supabase
      .from("products")
      .select("id, name, slug, brand, main_image, price, custom_price, created_at", { count: "exact" })
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (q) query = query.ilike("name", `%${q}%`);

    const { data: rows, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const productIds = (rows ?? []).map((row) => row.id);
    const { data: picksRows } = productIds.length
      ? await supabase
          .from("category_featured_products")
          .select("product_id, priority, created_at")
          .eq("category_id", categoryId)
          .in("product_id", productIds)
      : { data: [] as { product_id: string; priority: number; created_at: string }[] };

    const pickByProductId = new Map(
      (picksRows ?? []).map((pick) => [pick.product_id, { priority: pick.priority, createdAt: pick.created_at }])
    );

    const products = (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      image: row.main_image ?? "/assets/images/placeholder.png",
      price: row.custom_price ?? row.price ?? 0,
      highlighted: pickByProductId.has(row.id),
      priority: pickByProductId.get(row.id)?.priority ?? null
    }));

    return NextResponse.json({
      products,
      page,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
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
      revalidateCategorySurfaces(categoryRow?.slug ?? null);
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
    revalidateCategorySurfaces(categoryRow?.slug ?? null);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
