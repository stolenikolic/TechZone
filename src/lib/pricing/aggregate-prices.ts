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
import { computeOriginalPriceKm } from "./original-price";
import { getEffectivePrice } from "lib/effective-price";
import { resolvePriceSourceRegion } from "./price-source-region";

/** Number of supplier_products rows to fetch per query. Keep at 1000 to stay under PostgREST default row limit. */
const FETCH_PAGE_SIZE = 1000;
/** PostgREST .in(product_id) chunk size for scoped aggregation. */
const PRODUCT_IDS_IN_CHUNK = 100;
/** Number of products to update per RPC call. */
const UPDATE_BATCH_SIZE = 2500;

type SupplierProductRow = {
  product_id: string;
  supplier_id: string;
  price_amount: number;
  currency: string;
  suppliers: SupplierPricingRow | SupplierPricingRow[] | null;
};

type WinnerOffer = {
  supplierId: string;
  currency: string;
};

type ProductMarginRow = {
  id: string;
  selling_margin_override: number | null;
  custom_price: number | null;
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

function ingestSupplierOfferRows(
  rows: SupplierProductRow[],
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"],
  minCostByProduct: Map<string, number>,
  winnerByProduct: Map<string, WinnerOffer>
): void {
  for (const row of rows) {
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
      winnerByProduct.set(row.product_id, {
        supplierId: row.supplier_id,
        currency: row.currency ?? ""
      });
    }
  }
}

async function loadMinCostByProduct(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"],
  productIdsFilter: string[] | null
): Promise<{ minCostByProduct: Map<string, number>; winnerByProduct: Map<string, WinnerOffer> }> {
  const minCostByProduct = new Map<string, number>();
  const winnerByProduct = new Map<string, WinnerOffer>();

  if (productIdsFilter != null) {
    for (let i = 0; i < productIdsFilter.length; i += PRODUCT_IDS_IN_CHUNK) {
      const slice = productIdsFilter.slice(i, i + PRODUCT_IDS_IN_CHUNK);
      const { data: rows, error: fetchError } = await supabase
        .from("supplier_products")
        .select(
          "product_id, supplier_id, price_amount, currency, suppliers(pricing_formula, cost_adjustment_multiplier)"
        )
        .in("product_id", slice)
        .eq("is_active", true);

      if (fetchError) {
        throw new Error(`supplier_products fetch failed: ${fetchError.message}`);
      }

      ingestSupplierOfferRows(
        (rows ?? []) as SupplierProductRow[],
        settings,
        minCostByProduct,
        winnerByProduct
      );
    }
    return { minCostByProduct, winnerByProduct };
  }

  let offset = 0;
  while (true) {
    const { data: rows, error: fetchError } = await supabase
      .from("supplier_products")
      .select(
        "product_id, supplier_id, price_amount, currency, suppliers(pricing_formula, cost_adjustment_multiplier)"
      )
      .not("product_id", "is", null)
      .eq("is_active", true)
      .order("product_id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);

    if (fetchError) {
      throw new Error(`supplier_products fetch failed: ${fetchError.message}`);
    }

    const chunk = (rows ?? []) as SupplierProductRow[];
    if (chunk.length === 0) break;

    ingestSupplierOfferRows(chunk, settings, minCostByProduct, winnerByProduct);
    offset += chunk.length;
    if (chunk.length < FETCH_PAGE_SIZE) break;
  }

  return { minCostByProduct, winnerByProduct };
}

type AggregatePricesOptions = {
  /** When set, only these master products are updated (e.g. newly imported). */
  productIds?: string[];
  /** Run reconcile_products_is_active_from_supplier_offers after price update. Default true for full catalog. */
  reconcile?: boolean;
};

async function aggregatePricesCore(options?: AggregatePricesOptions): Promise<AggregatePricesResult> {
  const productIdsFilter =
    options?.productIds != null && options.productIds.length > 0
      ? Array.from(new Set(options.productIds))
      : null;
  const shouldReconcile = options?.reconcile ?? productIdsFilter == null;

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

  let minCostByProduct: Map<string, number>;
  let winnerByProduct: Map<string, WinnerOffer>;
  try {
    const loaded = await loadMinCostByProduct(supabase, settings, productIdsFilter);
    minCostByProduct = loaded.minCostByProduct;
    winnerByProduct = loaded.winnerByProduct;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { updated: 0, batches: 0, error: message, warnings: settingWarnings };
  }

  if (minCostByProduct.size === 0) {
    if (shouldReconcile) {
      const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
      const warnings = mergeWarnings(
        settingWarnings,
        rec.error ? [`reconcile_products_is_active_from_supplier_offers: ${rec.error}`] : undefined
      );
      return { updated: 0, batches: 0, warnings };
    }
    return { updated: 0, batches: 0, warnings: settingWarnings };
  }

  const productIds = Array.from(minCostByProduct.keys());
  const marginByProduct = new Map<string, { category: number | null; product: number | null }>();
  const customPriceByProduct = new Map<string, number | null>();

  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const slice = productIds.slice(i, i + chunkSize);
    const { data: prodRows, error: pErr } = await supabase
      .from("products")
      .select("id, selling_margin_override, custom_price, categories(selling_margin_default)")
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
      customPriceByProduct.set(
        pr.id,
        pr.custom_price != null ? Number(pr.custom_price) : null
      );
    }
  }

  const markupPercent = settings.original_price_markup_percent;
  const entries: { id: string; price: number; original_price: number }[] = [];

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
    const enginePrice = round2(finalPrice);
    const customPrice = customPriceByProduct.get(productId) ?? null;
    const effective = getEffectivePrice(customPrice, enginePrice);
    const original_price = computeOriginalPriceKm(effective, markupPercent);
    entries.push({ id: productId, price: enginePrice, original_price });
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

  const sourceEntries: {
    id: string;
    price_source_region: string;
    price_source_supplier_id: string | null;
  }[] = [];

  for (const productId of productIds) {
    const customPrice = customPriceByProduct.get(productId) ?? null;
    const winner = winnerByProduct.get(productId);
    const region = resolvePriceSourceRegion(customPrice, winner?.currency);
    if (!region) continue;
    sourceEntries.push({
      id: productId,
      price_source_region: region,
      price_source_supplier_id: winner?.supplierId ?? null
    });
  }

  for (let i = 0; i < sourceEntries.length; i += UPDATE_BATCH_SIZE) {
    const batch = sourceEntries.slice(i, i + UPDATE_BATCH_SIZE);
    const { error: sourceRpcError } = await supabase.rpc("update_products_price_sources", {
      entries: batch
    });
    if (sourceRpcError) {
      return {
        updated: updatedCount,
        batches,
        error: `update_products_price_sources RPC failed: ${sourceRpcError.message}`,
        warnings: settingWarnings
      };
    }
  }

  let warnings: string[] | undefined = settingWarnings;
  if (shouldReconcile) {
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    warnings = mergeWarnings(
      settingWarnings,
      rec.error ? [`reconcile_products_is_active_from_supplier_offers: ${rec.error}`] : undefined
    );
  }

  return {
    updated: updatedCount,
    batches,
    warnings
  };
}

/**
 * Loads supplier_products with supplier formulas, computes min acquisition KM per product,
 * applies selling rules from DB settings/tiers/category/product, then batch-updates products.price.
 */
export async function aggregatePrices(): Promise<AggregatePricesResult> {
  return aggregatePricesCore();
}

/** Aggregate selling price only for given master product IDs (e.g. after iPon discovery import). */
export async function aggregatePricesForProductIds(
  productIds: string[]
): Promise<AggregatePricesResult> {
  if (productIds.length === 0) return { updated: 0, batches: 0 };
  return aggregatePricesCore({ productIds, reconcile: false });
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
