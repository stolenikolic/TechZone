import { NextResponse } from "next/server";
import {
  computeAcquisitionKm,
  computeFinalSellingKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  type PricingMarginTierRow,
  type PricingSettingsRow
} from "lib/pricing";
import { guardAdminApi } from "lib/auth/admin-route";
import { createSupabaseServiceClient } from "utils/supabase";

type DbRow = {
  id: string;
  supplier_product_id: string;
  price_amount: number | null;
  currency: string | null;
  updated_at: string;
  suppliers:
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }[]
    | null;
};

type DbProductMargin = {
  selling_margin_override: number | null;
  categories:
    | { selling_margin_default: number | null }
    | { selling_margin_default: number | null }[]
    | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();

    const [{ data: settingsRows, error: settingsError }, { data: tierRows, error: tiersError }] =
      await Promise.all([
        supabase.from("pricing_settings").select("*").limit(1),
        supabase
          .from("pricing_margin_tiers")
          .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
          .order("min_cost_km", { ascending: true })
          .order("sort_order", { ascending: true })
      ]);

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 400 });
    }
    if (tiersError) {
      return NextResponse.json({ error: tiersError.message }, { status: 400 });
    }

    const { settings } = resolvePricingSettingsRow(
      (settingsRows?.[0] ?? null) as PricingSettingsRow | null
    );
    const tiers = (tierRows ?? []) as PricingMarginTierRow[];

    const { data: productMarginRow, error: productMarginError } = await supabase
      .from("products")
      .select("selling_margin_override, categories(selling_margin_default)")
      .eq("id", id)
      .maybeSingle();

    if (productMarginError) {
      return NextResponse.json({ error: productMarginError.message }, { status: 400 });
    }
    if (!productMarginRow) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const pm = productMarginRow as DbProductMargin;
    const categoryMargin =
      (Array.isArray(pm.categories)
        ? pm.categories[0]?.selling_margin_default
        : pm.categories?.selling_margin_default) ?? null;

    const { data: rows, error } = await supabase
      .from("supplier_products")
      .select(
        "id, supplier_product_id, price_amount, currency, updated_at, suppliers(id, name, code, pricing_formula, cost_adjustment_multiplier)"
      )
      .eq("product_id", id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const out = ((rows ?? []) as DbRow[]).map((row) => {
      const supplier =
        row.suppliers == null
          ? null
          : Array.isArray(row.suppliers)
            ? row.suppliers[0] ?? null
            : row.suppliers;

      const acquisitionKm =
        row.price_amount != null
          ? computeAcquisitionKm(
              Number(row.price_amount),
              row.currency ?? "",
              {
                id: supplier?.id ?? "",
                pricing_formula: supplier?.pricing_formula ?? null,
                cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
              },
              settings
            )
          : null;

      const sellingKm =
        acquisitionKm != null && acquisitionKm > 0
          ? computeFinalSellingKm(
              acquisitionKm,
              resolveSellingMultiplier(
                acquisitionKm,
                tiers,
                settings,
                categoryMargin,
                pm.selling_margin_override
              ),
              settings
            )
          : null;

      return {
        id: row.id,
        supplierProductId: row.supplier_product_id,
        supplierName: supplier?.name ?? "Unknown",
        supplierCode: supplier?.code ?? "unknown",
        priceAmountHuf: row.price_amount != null ? Number(row.price_amount) : null,
        currency: row.currency ?? "",
        acquisitionKm,
        sellingKm,
        updatedAt: row.updated_at
      };
    });

    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

