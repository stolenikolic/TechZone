import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { invalidateRegistryCaches } from "lib/suppliers/registry";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  supplier_id: string;
  internal_category_id: string;
  supplier_category_key: string | null;
  listing_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  categories: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

function pickCategory(raw: Row["categories"]): { id: string; name: string; slug: string } | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_categories")
      .select(
        "id, supplier_id, internal_category_id, supplier_category_key, listing_url, is_active, sort_order, created_at, updated_at, categories(id, name, slug)"
      )
      .eq("supplier_id", id)
      .order("sort_order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      internalCategoryId: row.internal_category_id,
      supplierCategoryKey: row.supplier_category_key,
      listingUrl: row.listing_url,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      category: pickCategory(row.categories)
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: supplierId } = await context.params;
    const body = (await request.json()) as {
      internalCategoryId?: string;
      supplierCategoryKey?: string | null;
      listingUrl?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    };
    if (!body.internalCategoryId) {
      return NextResponse.json({ error: "internalCategoryId is required" }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_categories")
      .upsert(
        {
          supplier_id: supplierId,
          internal_category_id: body.internalCategoryId,
          supplier_category_key: body.supplierCategoryKey ?? null,
          listing_url: body.listingUrl ?? null,
          is_active: body.isActive ?? true,
          sort_order: body.sortOrder ?? 0,
          updated_at: new Date().toISOString()
        },
        { onConflict: "supplier_id,internal_category_id" }
      )
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidateRegistryCaches(supplierId);
    return NextResponse.json({ id: data?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: supplierId } = await context.params;
    const url = new URL(request.url);
    const rowId = url.searchParams.get("rowId")?.trim();
    if (!rowId) return NextResponse.json({ error: "rowId required" }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", supplierId)
      .eq("id", rowId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidateRegistryCaches(supplierId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
