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
import { withPostgrestTransientRetry } from "lib/suppliers/ipon/transient-retry";

/**
 * Active linked offers fetched per query. Stay at 1000 (PostgREST default max rows).
 * Full-catalog reads page by primary key, not OFFSET + ORDER BY product_id: that sort
 * materializes every active offer and trips the API statement_timeout on the first page.
 */
const FETCH_PAGE_SIZE = 1000;
const OFFER_COLUMNS = "id, product_id, supplier_id, price_amount, currency";
/** PostgREST .in(product_id) chunk size for scoped aggregation. */
const PRODUCT_IDS_IN_CHUNK = 100;
/** Number of products to update per RPC call (price/original_price are unindexed → cheap HOT updates). */
const UPDATE_BATCH_SIZE = 2500;
/**
 * update_products_price_sources also writes price_source_region, which is indexed
 * (idx_products_price_source_region). That disables HOT updates and forces every
 * index on the row to be rewritten, making this RPC much more expensive per row
 * than update_products_prices — keep its batches smaller to avoid statement timeouts.
 */
const SOURCE_UPDATE_BATCH_SIZE = 500;

type SupplierProductRow = {
  id: string;
  product_id: string;
  supplier_id: string;
  price_amount: number;
  currency: string;
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
  /** Masters whose is_active changed during reconcile. Set when reconcile ran. */
  activeReconciled?: number;
};

function ingestSupplierOfferRows(
  rows: SupplierProductRow[],
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"],
  suppliersById: Map<string, SupplierPricingRow>,
  minCostByProduct: Map<string, number>,
  winnerByProduct: Map<string, WinnerOffer>
): void {
  for (const row of rows) {
    const supplier = suppliersById.get(row.supplier_id);
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
  suppliersById: Map<string, SupplierPricingRow>,
  productIdsFilter: string[] | null
): Promise<{ minCostByProduct: Map<string, number>; winnerByProduct: Map<string, WinnerOffer> }> {
  const minCostByProduct = new Map<string, number>();
  const winnerByProduct = new Map<string, WinnerOffer>();

  if (productIdsFilter != null) {
    for (let i = 0; i < productIdsFilter.length; i += PRODUCT_IDS_IN_CHUNK) {
      const slice = productIdsFilter.slice(i, i + PRODUCT_IDS_IN_CHUNK);
      const { data: rows, error: fetchError } = await supabase
        .from("supplier_products")
        .select(OFFER_COLUMNS)
        .in("product_id", slice)
        .eq("is_active", true);

      if (fetchError) {
        throw new Error(`supplier_products fetch failed: ${fetchError.message}`);
      }

      ingestSupplierOfferRows(
        (rows ?? []) as SupplierProductRow[],
        settings,
        suppliersById,
        minCostByProduct,
        winnerByProduct
      );
    }
    return { minCostByProduct, winnerByProduct };
  }

  let cursor: string | null = null;
  while (true) {
    let query = supabase
      .from("supplier_products")
      .select(OFFER_COLUMNS)
      .not("product_id", "is", null)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(FETCH_PAGE_SIZE);

    if (cursor) query = query.gt("id", cursor);

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`supplier_products fetch failed: ${fetchError.message}`);
    }

    const chunk = (rows ?? []) as SupplierProductRow[];
    if (chunk.length === 0) break;

    ingestSupplierOfferRows(chunk, settings, suppliersById, minCostByProduct, winnerByProduct);

    const lastId = chunk[chunk.length - 1]?.id;
    if (!lastId || chunk.length < FETCH_PAGE_SIZE) break;
    cursor = lastId;
  }

  return { minCostByProduct, winnerByProduct };
}

type AggregatePricesOptions = {
  /** When set, only these master products are updated (e.g. newly imported). */
  productIds?: string[];
  /**
   * Run reconcile_products_is_active_from_supplier_offers even when the price update fails.
   * Default true for a full catalog (drift repair). Scoped jobs pass the ids they touched.
   */
  reconcile?: boolean;
};

async function aggregatePricesCore(options?: AggregatePricesOptions): Promise<AggregatePricesResult> {
  const productIdsFilter =
    options?.productIds != null && options.productIds.length > 0
      ? Array.from(new Set(options.productIds))
      : null;
  const shouldReconcile = options?.reconcile ?? productIdsFilter == null;

  const supabase = createSupabaseServiceClient();

  async function finish(partial: AggregatePricesResult): Promise<AggregatePricesResult> {
    if (!shouldReconcile) return partial;
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase, productIdsFilter ?? undefined);
    if (rec.error) {
      const msg = `reconcile_products_is_active_from_supplier_offers: ${rec.error}`;
      return {
        ...partial,
        error: partial.error ? `${partial.error}; ${msg}` : msg
      };
    }
    if (rec.updated) {
      console.log(`[aggregate] products.is_active reconciled: ${rec.updated}`);
    }
    return { ...partial, activeReconciled: rec.updated ?? 0 };
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from("pricing_settings")
    .select("*")
    .limit(1);

  if (settingsError) {
    return finish({ updated: 0, batches: 0, error: `pricing_settings: ${settingsError.message}` });
  }

  const settingsRow = (settingsRows?.[0] ?? null) as PricingSettingsRow | null;
  const { settings, warnings: settingWarnings } = resolvePricingSettingsRow(settingsRow);

  const { data: tierRows, error: tiersError } = await supabase
    .from("pricing_margin_tiers")
    .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
    .order("min_cost_km", { ascending: true })
    .order("sort_order", { ascending: true });

  if (tiersError) {
    return finish({ updated: 0, batches: 0, error: `pricing_margin_tiers: ${tiersError.message}` });
  }

  const tiers = (tierRows ?? []) as PricingMarginTierRow[];

  const { data: supplierFormulaRows, error: suppliersError } = await supabase
    .from("suppliers")
    .select("id, pricing_formula, cost_adjustment_multiplier");

  if (suppliersError) {
    return finish({
      updated: 0,
      batches: 0,
      error: `suppliers: ${suppliersError.message}`,
      warnings: settingWarnings
    });
  }

  const suppliersById = new Map<string, SupplierPricingRow>();
  for (const row of (supplierFormulaRows ?? []) as SupplierPricingRow[]) {
    suppliersById.set(row.id, row);
  }
  const needsAlzaTax = Array.from(suppliersById.values()).some(
    (r) => r.pricing_formula === "hungary_huf_alza_tax"
  );

  const validationError = validatePricingForAggregation(settings, tiers, needsAlzaTax);
  if (validationError) {
    return finish({ updated: 0, batches: 0, error: validationError, warnings: settingWarnings });
  }

  let minCostByProduct: Map<string, number>;
  let winnerByProduct: Map<string, WinnerOffer>;
  try {
    const loaded = await loadMinCostByProduct(supabase, settings, suppliersById, productIdsFilter);
    minCostByProduct = loaded.minCostByProduct;
    winnerByProduct = loaded.winnerByProduct;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return finish({ updated: 0, batches: 0, error: message, warnings: settingWarnings });
  }

  if (minCostByProduct.size === 0) {
    return finish({ updated: 0, batches: 0, warnings: settingWarnings });
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
      return finish({
        updated: 0,
        batches: 0,
        error: `products margin fetch failed: ${pErr.message}`,
        warnings: settingWarnings
      });
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
      return finish({
        updated: 0,
        batches: 0,
        error: `Invalid selling multiplier for product ${productId} (check tiers / default_selling_margin / overrides).`,
        warnings: settingWarnings
      });
    }
    const finalPrice = computeFinalSellingKm(costKm, m, settings);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return finish({
        updated: 0,
        batches: 0,
        error: `Computed invalid selling price for product ${productId}.`,
        warnings: settingWarnings
      });
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
    const { error: rpcError } = await withPostgrestTransientRetry("aggregatePrices.updatePrices", async () =>
      supabase.rpc("update_products_prices", { entries: batch })
    );

    if (rpcError) {
      return finish({
        updated: updatedCount,
        batches,
        error: `update_products_prices RPC failed: ${rpcError.message}`,
        warnings: settingWarnings
      });
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

  for (let i = 0; i < sourceEntries.length; i += SOURCE_UPDATE_BATCH_SIZE) {
    const batch = sourceEntries.slice(i, i + SOURCE_UPDATE_BATCH_SIZE);
    const { error: sourceRpcError } = await withPostgrestTransientRetry(
      "aggregatePrices.updatePriceSources",
      async () => supabase.rpc("update_products_price_sources", { entries: batch })
    );
    if (sourceRpcError) {
      return finish({
        updated: updatedCount,
        batches,
        error: `update_products_price_sources RPC failed: ${sourceRpcError.message}`,
        warnings: settingWarnings
      });
    }
  }

  return finish({
    updated: updatedCount,
    batches,
    warnings: settingWarnings
  });
}

/**
 * Loads supplier_products with supplier formulas, computes min acquisition KM per product,
 * applies selling rules from DB settings/tiers/category/product, then batch-updates products.price.
 */
export async function aggregatePrices(): Promise<AggregatePricesResult> {
  return aggregatePricesCore();
}

/**
 * Aggregate selling price only for given master product IDs (e.g. after iPon discovery import,
 * or the handful of masters a 2h/4h supplier price-sync just touched).
 *
 * `reconcile` defaults to `false`. Pass `{ reconcile: true }` to also sync `products.is_active`
 * for these IDs. A failed reconcile is returned on `error` so the job does not look successful.
 * Catalog-wide drift repair is `repairProductsActiveDrift`, not this scoped call.
 */
export async function aggregatePricesForProductIds(
  productIds: string[],
  options?: { reconcile?: boolean }
): Promise<AggregatePricesResult> {
  if (productIds.length === 0) return { updated: 0, batches: 0 };
  return aggregatePricesCore({ productIds, reconcile: options?.reconcile ?? false });
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
      ...(r.activeReconciled != null ? { active_reconciled: r.activeReconciled } : {}),
      ...(r.error ? { error: r.error } : {}),
      ...(r.warnings?.length ? { warnings: r.warnings } : {})
    }
  };
}
