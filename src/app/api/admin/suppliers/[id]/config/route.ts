import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { invalidateRegistryCaches } from "lib/suppliers/registry";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  supplier_id: string;
  key: string;
  value: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_scrape_config")
      .select("id, supplier_id, key, value, is_active, created_at, updated_at")
      .eq("supplier_id", id)
      .order("key", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      isActive: row.is_active
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
      key?: string;
      value?: unknown;
      isActive?: boolean;
    };
    if (!body.key || body.value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_scrape_config")
      .upsert(
        {
          supplier_id: supplierId,
          key: body.key,
          value: body.value,
          is_active: body.isActive ?? true,
          updated_at: new Date().toISOString()
        },
        { onConflict: "supplier_id,key" }
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
      .from("supplier_scrape_config")
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
