import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { invalidateRegistryCaches } from "lib/suppliers/registry";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  supplier_id: string;
  internal_category_id: string | null;
  attribute_id: string;
  source_field_name: string;
  match_mode: "exact" | "contains" | "regex";
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  attributes: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  categories: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

function pickFirst<T>(raw: T | T[] | null): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_attribute_mappings")
      .select(
        "id, supplier_id, internal_category_id, attribute_id, source_field_name, match_mode, priority, is_active, created_at, updated_at, attributes(id, name, slug), categories(id, name, slug)"
      )
      .eq("supplier_id", id)
      .order("priority", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      internalCategoryId: row.internal_category_id,
      attributeId: row.attribute_id,
      sourceFieldName: row.source_field_name,
      matchMode: row.match_mode,
      priority: row.priority,
      isActive: row.is_active,
      attribute: pickFirst(row.attributes),
      category: pickFirst(row.categories)
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: supplierId } = await context.params;
    const body = (await request.json()) as {
      internalCategoryId?: string | null;
      attributeId?: string;
      sourceFieldName?: string;
      matchMode?: "exact" | "contains" | "regex";
      priority?: number;
      isActive?: boolean;
    };
    if (!body.attributeId || !body.sourceFieldName) {
      return NextResponse.json({ error: "attributeId and sourceFieldName are required" }, { status: 400 });
    }
    const matchMode = body.matchMode ?? "exact";
    if (!["exact", "contains", "regex"].includes(matchMode)) {
      return NextResponse.json({ error: "Invalid matchMode" }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("supplier_attribute_mappings")
      .insert({
        supplier_id: supplierId,
        internal_category_id: body.internalCategoryId ?? null,
        attribute_id: body.attributeId,
        source_field_name: body.sourceFieldName,
        match_mode: matchMode,
        priority: body.priority ?? 100,
        is_active: body.isActive ?? true
      })
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: supplierId } = await context.params;
    const body = (await request.json()) as {
      id?: string;
      internalCategoryId?: string | null;
      attributeId?: string;
      sourceFieldName?: string;
      matchMode?: "exact" | "contains" | "regex";
      priority?: number;
      isActive?: boolean;
    };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.internalCategoryId !== undefined) update.internal_category_id = body.internalCategoryId;
    if (body.attributeId !== undefined) update.attribute_id = body.attributeId;
    if (body.sourceFieldName !== undefined) update.source_field_name = body.sourceFieldName;
    if (body.matchMode !== undefined) update.match_mode = body.matchMode;
    if (body.priority !== undefined) update.priority = body.priority;
    if (body.isActive !== undefined) update.is_active = body.isActive;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("supplier_attribute_mappings")
      .update(update)
      .eq("id", body.id)
      .eq("supplier_id", supplierId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidateRegistryCaches(supplierId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: supplierId } = await context.params;
    const url = new URL(request.url);
    const rowId = url.searchParams.get("rowId")?.trim();
    if (!rowId) return NextResponse.json({ error: "rowId required" }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("supplier_attribute_mappings")
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
