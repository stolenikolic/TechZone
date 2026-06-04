import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { deliveryPolicyToJson, parseDeliveryPolicyJson } from "lib/suppliers/delivery-policy";
import type { DeliveryPolicy } from "lib/product-offers";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

function isAllowedFormula(f: string | null | undefined): boolean {
  if (f == null || f === "") return true;
  return f === "ipon_huf" || f === "hungary_huf_alza_tax" || f === "domestic_custom";
}

/** PATCH /api/admin/suppliers/:id — body: { pricing_formula?, cost_adjustment_multiplier?, enrichment_priority?, delivery_policy? } */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      pricing_formula?: string | null;
      cost_adjustment_multiplier?: number;
      enrichment_priority?: number;
      delivery_policy?: DeliveryPolicy | null;
    };

    const patch: Record<string, unknown> = {};

    if ("pricing_formula" in body) {
      const f = body.pricing_formula;
      if (!isAllowedFormula(f)) {
        return NextResponse.json({ error: "Invalid pricing_formula." }, { status: 400 });
      }
      patch.pricing_formula = f === "" ? null : f;
    }

    if ("cost_adjustment_multiplier" in body) {
      const m = body.cost_adjustment_multiplier;
      if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) {
        return NextResponse.json({ error: "cost_adjustment_multiplier must be a positive number." }, { status: 400 });
      }
      patch.cost_adjustment_multiplier = m;
    }

    if ("enrichment_priority" in body) {
      const p = body.enrichment_priority;
      if (typeof p !== "number" || !Number.isFinite(p) || p < 1) {
        return NextResponse.json({ error: "enrichment_priority must be a positive integer." }, { status: 400 });
      }
      patch.enrichment_priority = Math.round(p);
    }

    if ("delivery_policy" in body) {
      if (body.delivery_policy == null) {
        patch.delivery_policy = null;
      } else {
        const parsed = parseDeliveryPolicyJson(body.delivery_policy);
        if (!parsed) {
          return NextResponse.json({ error: "Invalid delivery_policy." }, { status: 400 });
        }
        patch.delivery_policy = deliveryPolicyToJson(parsed);
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
