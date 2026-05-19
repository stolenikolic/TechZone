import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type TierInput = {
  id?: string;
  min_cost_km: number;
  max_cost_km: number | null;
  margin_multiplier: number;
  sort_order?: number;
};

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function validateTiers(tiers: unknown): string | null {
  if (!Array.isArray(tiers)) return "tiers must be an array";
  for (const t of tiers) {
    if (!t || typeof t !== "object") return "Invalid tier row";
    const row = t as Record<string, unknown>;
    const minCost = row.min_cost_km;
    const maxCost = row.max_cost_km;
    if (!isPositiveNumber(minCost as number)) return "Each tier needs min_cost_km > 0";
    if (maxCost != null && !(typeof maxCost === "number" && maxCost > (minCost as number))) {
      return "tier max_cost_km must be null or > min_cost_km";
    }
    if (!isPositiveNumber(row.margin_multiplier as number)) return "Each tier needs margin_multiplier > 0";
  }
  return null;
}

/**
 * GET /api/admin/pricing — settings row, margin tiers, categories (margin), suppliers (formula).
 * PUT /api/admin/pricing — replace settings + tiers (same pattern as other admin routes: service role on server).
 */
export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();

    const [{ data: settingsRows, error: sErr }, { data: tiers, error: tErr }, { data: categories, error: cErr }, { data: suppliers, error: pErr }] =
      await Promise.all([
        supabase.from("pricing_settings").select("*").limit(1),
        supabase
          .from("pricing_margin_tiers")
          .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
          .order("min_cost_km", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase.from("categories").select("id, name, slug, selling_margin_default").order("name", { ascending: true }),
        supabase.from("suppliers").select("id, name, code, pricing_formula, cost_adjustment_multiplier").order("name")
      ]);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    return NextResponse.json({
      settings: settingsRows?.[0] ?? null,
      tiers: tiers ?? [],
      categories: categories ?? [],
      suppliers: suppliers ?? []
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      settings?: Record<string, unknown>;
      tiers?: unknown;
    };

    const supabase = createSupabaseServiceClient();

    const { data: existing, error: exErr } = await supabase.from("pricing_settings").select("id").limit(1);
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
    const settingsId = existing?.[0]?.id as string | undefined;
    if (!settingsId) {
      return NextResponse.json({ error: "pricing_settings row missing; run migration." }, { status: 400 });
    }

    if (body.settings && typeof body.settings === "object") {
      const allowed = [
        "kurs_eur",
        "eur_km_rate",
        "alza_tax",
        "pdv_bih",
        "default_selling_margin",
        "min_absolute_profit_km",
        "min_margin_percent",
        "high_cost_threshold_km",
        "high_cost_max_margin_multiplier",
        "original_price_markup_percent"
      ] as const;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (key in body.settings) patch[key] = body.settings[key];
      }
      const { error: upErr } = await supabase.from("pricing_settings").update(patch).eq("id", settingsId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    if (body.tiers !== undefined) {
      const terr = validateTiers(body.tiers);
      if (terr) return NextResponse.json({ error: terr }, { status: 400 });

      const { error: delErr } = await supabase.from("pricing_margin_tiers").delete().not("id", "is", null);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

      const rows = (body.tiers as TierInput[]).map((t, i) => ({
        min_cost_km: t.min_cost_km,
        max_cost_km: t.max_cost_km,
        margin_multiplier: t.margin_multiplier,
        sort_order: t.sort_order ?? i
      }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("pricing_margin_tiers").insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
