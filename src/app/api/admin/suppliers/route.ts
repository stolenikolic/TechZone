import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { invalidateRegistryCaches } from "lib/suppliers/registry";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type SupplierRow = {
  id: string;
  name: string;
  code: string;
  kind: string | null;
  base_url: string | null;
  default_currency: string | null;
  creates_master_products: boolean | null;
  is_active: boolean | null;
  enrichment_priority: number | null;
  created_at: string;
};

export type AdminSupplier = {
  id: string;
  name: string;
  code: string;
  kind: string | null;
  baseUrl: string | null;
  defaultCurrency: string | null;
  createsMasterProducts: boolean;
  isActive: boolean;
  enrichmentPriority: number;
  createdAt: string;
};

function toAdminSupplier(row: SupplierRow): AdminSupplier {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    baseUrl: row.base_url,
    defaultCurrency: row.default_currency,
    createsMasterProducts: Boolean(row.creates_master_products),
    isActive: Boolean(row.is_active),
    enrichmentPriority: row.enrichment_priority ?? 100,
    createdAt: row.created_at
  };
}

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, code, kind, base_url, default_currency, creates_master_products, is_active, enrichment_priority, created_at")
      .order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ items: ((data ?? []) as SupplierRow[]).map(toAdminSupplier) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      id?: string;
      kind?: string | null;
      baseUrl?: string | null;
      defaultCurrency?: string | null;
      createsMasterProducts?: boolean;
      isActive?: boolean;
      enrichmentPriority?: number;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const update: Record<string, unknown> = {};
    if (body.kind !== undefined) update.kind = body.kind;
    if (body.baseUrl !== undefined) update.base_url = body.baseUrl;
    if (body.defaultCurrency !== undefined) update.default_currency = body.defaultCurrency;
    if (body.createsMasterProducts !== undefined) update.creates_master_products = body.createsMasterProducts;
    if (body.isActive !== undefined) update.is_active = body.isActive;
    if (body.enrichmentPriority !== undefined) {
      const p = body.enrichmentPriority;
      if (typeof p !== "number" || !Number.isFinite(p) || p < 1) {
        return NextResponse.json({ error: "enrichmentPriority must be a positive integer." }, { status: 400 });
      }
      update.enrichment_priority = Math.round(p);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("suppliers")
      .update(update)
      .eq("id", body.id)
      .select("id, name, code, kind, base_url, default_currency, creates_master_products, is_active, enrichment_priority, created_at")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    invalidateRegistryCaches(body.id);
    return NextResponse.json({ item: toAdminSupplier(data as SupplierRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
