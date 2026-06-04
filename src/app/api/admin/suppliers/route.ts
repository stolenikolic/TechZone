import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { invalidateRegistryCaches } from "lib/suppliers/registry";
import { deliveryPolicyToJson, parseDeliveryPolicyJson } from "lib/suppliers/delivery-policy";
import type { DeliveryPolicy } from "lib/product-offers";
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
  delivery_policy: unknown;
  inbound_lead_days_default: number | null;
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
  deliveryPolicy: DeliveryPolicy | null;
  inboundLeadDaysDefault: number;
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
    deliveryPolicy: parseDeliveryPolicyJson(row.delivery_policy),
    inboundLeadDaysDefault:
      row.inbound_lead_days_default != null && Number.isFinite(Number(row.inbound_lead_days_default))
        ? Math.max(0, Math.round(Number(row.inbound_lead_days_default)))
        : 7,
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
      .select("id, name, code, kind, base_url, default_currency, creates_master_products, is_active, enrichment_priority, delivery_policy, inbound_lead_days_default, created_at")
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
      deliveryPolicy?: DeliveryPolicy | null;
      inboundLeadDaysDefault?: number;
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
    if (body.deliveryPolicy !== undefined) {
      if (body.deliveryPolicy == null) {
        update.delivery_policy = null;
      } else {
        const parsed = parseDeliveryPolicyJson(body.deliveryPolicy);
        if (!parsed) {
          return NextResponse.json({ error: "Invalid deliveryPolicy." }, { status: 400 });
        }
        update.delivery_policy = deliveryPolicyToJson(parsed);
      }
    }
    if (body.inboundLeadDaysDefault !== undefined) {
      const d = body.inboundLeadDaysDefault;
      if (typeof d !== "number" || !Number.isFinite(d) || d < 0) {
        return NextResponse.json({ error: "inboundLeadDaysDefault must be a non-negative integer." }, { status: 400 });
      }
      update.inbound_lead_days_default = Math.round(d);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("suppliers")
      .update(update)
      .eq("id", body.id)
      .select("id, name, code, kind, base_url, default_currency, creates_master_products, is_active, enrichment_priority, delivery_policy, inbound_lead_days_default, created_at")
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
