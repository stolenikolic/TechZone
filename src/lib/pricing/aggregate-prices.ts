import { createSupabaseServiceClient } from "utils/supabase";
import { computeAcquisitionKm } from "./cost-km";
import { resolvePricingSettingsRow, validatePricingForAggregation } from "./resolve-settings";
import {
  computeFinalSellingKm,
  resolveSellingMultiplier,
  round2
} from "./sell-price";
import type { PricingMarginTierRow, PricingSettingsRow, SupplierPricingRow } from "./types";
import { reconcileProductsIsActiveFromSupplierOffers } from "./reconcile-product-active";

/** Number of supplier_products rows to fetch per query. Keep at 1000 to stay under PostgREST default row limit. */
const FETCH_PAGE_SIZE = 1000;
/** Number of products to update per RPC call. */
const UPDATE_BATCH_SIZE = 2500;

type SupplierProductRow = {
  product_id: string;
  supplier_id: string;
  price_amount: number;
  currency: string;
  suppliers: SupplierPricingRow | SupplierPricingRow[] | null;
};

type ProductMarginRow = {
  id: string;
  selling_margin_override: number | null;
  categories:
    | { selling_margin_default: number | null }
    | { selling_margin_default: number | null }[]
    | null;
};

function firstSupplier(raw: SupplierProductRow["suppliers"]): SupplierPricingRow | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function categoryDefaultFromProduct(row: ProductMarginRow): number | null {
  const raw = row.categories;
  if (raw == null) return null;
  const c = Array.isArray(raw) ? raw[0] ?? null : raw;
  const v = c?.selling_margin_default;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

export type AggregatePricesResult = {
  updated: number;
  batches: number;
  warnings?: string[];
  error?: string;
};

function mergeWarnings(...lists: (string[] | undefined)[]): string[] | undefined {
  const out: string[] = [];
  for (const l of lists) {
    if (l) for (const w of l) out.push(w);
  }
  return out.length ? out : undefined;
}

/**
 * Loads supplier_products with supplier formulas, computes min acquisition KM per product,
 * applies selling rules from DB settings/tiers/category/product, then batch-updates products.price.
 */
export async function aggregatePrices(): Promise<AggregatePricesResult> {
  const supabase = createSupabaseServiceClient();

  const { data: settingsRows, error: settingsError } = await supabase
    .from("pricing_settings")
    .select("*")
    .limit(1);

  if (settingsError) {
    return { updated: 0, batches: 0, error: `pricing_settings: ${settingsError.message}` };
  }

  const settingsRow = (settingsRows?.[0] ?? null) as PricingSettingsRow | null;
  const { settings, warnings: settingWarnings } = resolvePricingSettingsRow(settingsRow);

  const { data: tierRows, error: tiersError } = await supabase
    .from("pricing_margin_tiers")
    .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
    .order("min_cost_km", { ascending: true })
    .order("sort_order", { ascending: true });

  if (tiersError) {
    return { updated: 0, batches: 0, error: `pricing_margin_tiers: ${tiersError.message}` };
  }

  const tiers = (tierRows ?? []) as PricingMarginTierRow[];

  const { data: supplierFormulaRows } = await supabase.from("suppliers").select("pricing_formula");
  const needsAlzaTax = Boolean(
    (supplierFormulaRows ?? []).some((r) => r.pricing_formula === "hungary_huf_alza_tax")
  );

  const validationError = validatePricingForAggregation(settings, tiers, needsAlzaTax);
  if (validationError) {
    return { updated: 0, batches: 0, error: validationError, warnings: settingWarnings };
  }

  const minCostByProduct = new Map<string, number>();
  let offset = 0;

  while (true) {
    const { data: rows, error: fetchError } = await supabase
      .from("supplier_products")
      .select("product_id, supplier_id, price_amount, currency, suppliers(pricing_formula, cost_adjustment_multiplier)")
      .not("product_id", "is", null)
      .eq("is_active", true)
      .order("product_id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);

    if (fetchError) {
      return {
        updated: minCostByProduct.size,
        batches: 0,
        error: `supplier_products fetch failed: ${fetchError.message}`,
        warnings: settingWarnings
      };
    }

    const chunk = (rows ?? []) as SupplierProductRow[];
    if (chunk.length === 0) break;

    for (const row of chunk) {
      const supplier = firstSupplier(row.suppliers);
      const km = computeAcquisitionKm(
        Number(row.price_amount),
        row.currency ?? "",
        supplier ?? { id: row.supplier_id, pricing_formula: null, cost_adjustment_multiplier: 1 },
        settings
      );
      if (!Number.isFinite(km) || km <= 0) continue;

      const current = minCostByProduct.get(row.product_id);
      if (current === undefined || km < current) {
        minCostByProduct.set(row.product_id, km);
      }
    }

    offset += chunk.length;
    if (chunk.length < FETCH_PAGE_SIZE) break;
  }

  if (minCostByProduct.size === 0) {
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    const warnings = mergeWarnings(
      settingWarnings,
      rec.error ? [`reconcile_products_is_active_from_supplier_offers: ${rec.error}`] : undefined
    );
    return { updated: 0, batches: 0, warnings };
  }

  const productIds = Array.from(minCostByProduct.keys());
  const marginByProduct = new Map<string, { category: number | null; product: number | null }>();

  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const slice = productIds.slice(i, i + chunkSize);
    const { data: prodRows, error: pErr } = await supabase
      .from("products")
      .select("id, selling_margin_override, categories(selling_margin_default)")
      .in("id", slice);

    if (pErr) {
      return {
        updated: 0,
        batches: 0,
        error: `products margin fetch failed: ${pErr.message}`,
        warnings: settingWarnings
      };
    }

    for (const pr of (prodRows ?? []) as ProductMarginRow[]) {
      marginByProduct.set(pr.id, {
        product: pr.selling_margin_override,
        category: categoryDefaultFromProduct(pr)
      });
    }
  }

  const entries: { id: string; price: number }[] = [];

  for (const [productId, costKm] of Array.from(minCostByProduct.entries())) {
    const margins = marginByProduct.get(productId) ?? { category: null, product: null };
    const m = resolveSellingMultiplier(costKm, tiers, settings, margins.category, margins.product);
    if (!Number.isFinite(m) || m <= 0) {
      return {
        updated: 0,
        batches: 0,
        error: `Invalid selling multiplier for product ${productId} (check tiers / default_selling_margin / overrides).`,
        warnings: settingWarnings
      };
    }
    const finalPrice = computeFinalSellingKm(costKm, m, settings);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return {
        updated: 0,
        batches: 0,
        error: `Computed invalid selling price for product ${productId}.`,
        warnings: settingWarnings
      };
    }
    entries.push({ id: productId, price: round2(finalPrice) });
  }

  let batches = 0;
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += UPDATE_BATCH_SIZE) {
    const batch = entries.slice(i, i + UPDATE_BATCH_SIZE);
    const { error: rpcError } = await supabase.rpc("update_products_prices", {
      entries: batch
    });

    if (rpcError) {
      return {
        updated: updatedCount,
        batches,
        error: `update_products_prices RPC failed: ${rpcError.message}`,
        warnings: settingWarnings
      };
    }
    updatedCount += batch.length;
    batches += 1;
  }

  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  const warnings = mergeWarnings(
    settingWarnings,
    rec.error ? [`reconcile_products_is_active_from_supplier_offers: ${rec.error}`] : undefined
  );

  return {
    updated: updatedCount,
    batches,
    warnings
  };
}

/** Shape for `withJobRun` / admin APIs: flat fields + nested `summary` for `job_runs`. */
export function wrapAggregatePricesJobResult(r: AggregatePricesResult) {
  return {
    success: r.error == null,
    updated: r.updated,
    batches: r.batches,
    error: r.error,
    warnings: r.warnings,
    summary: {
      updated: r.updated,
      batches: r.batches,
      ...(r.error ? { error: r.error } : {}),
      ...(r.warnings?.length ? { warnings: r.warnings } : {})
    }
  };
}
