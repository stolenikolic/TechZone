/**
 * Admin „Import sada” for one iPon category.
 * Pages /api/shop/lists/{id}/products, enriches each page with tracking, then upserts.
 * Feed discovery and the legacy product/data import do not use this module.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregatePricesForProductIds, reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { fetchWithSession } from "lib/suppliers/shared/http-session";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  IPON_ACCEPT_LANGUAGE,
  IPON_BEFORE_LIST_API_MS,
  IPON_IMPORT_USER_AGENT,
  IponCaptchaError,
  listingUrlHasFilterParams,
  looksLikeCaptchaOrBlock,
  sleep,
  warmupIponSessionForListing
} from "./ipon-fetch";
import { getFirstPictureUrl } from "./ipon-product-images";
import {
  buildIponCategoryFromSupplierRow,
  deactivateInactiveIponInCategory,
  deactivateOtherIponOffersForProduct,
  insertOrLinkIponListItem,
  queueRescrapeAfterImageChange,
  type IponImportProductsResult,
  type SupplierCategoryImportInput
} from "./importProducts";
import { IPON_SUPPLIER_ID } from "./constants";
import { buildIponListProductsUrl } from "./listMembership";
import {
  isManualListImportComplete,
  manualOfferIsActive,
  mergeManualListProduct,
  mergeManualRawJson,
  parseIponManualListPage,
  type IponManualListPage
} from "./manualListMerge";
import { fetchIponTrackingBatch, type IponTrackingProduct } from "./trackingApi";
import { withPostgrestTransientRetry, withTransientHttpRetry } from "./transient-retry";
import { parseIponDeliveryDays, type IponProductItem } from "./transformProduct";
import { ensureIponXhrSession, IponXhrTokenError, iponXhrHeaders, type IponXhrSession } from "./xhrToken";

const IPON_ORIGIN = "https://iponcomp.com";
const CALL_GAP_MS = 300;
const MAX_PAGES = 500;
const DEFAULT_PAGE_SIZE = 36;

type MutableSession = { current: IponXhrSession | null };

type ExistingOffer = {
  product_id: string | null;
  price_amount: number | null;
  is_active: boolean | null;
  raw_json: unknown;
};

function supplierIdOf(item: IponProductItem): string {
  return typeof item.id === "number" && Number.isFinite(item.id) ? String(Math.trunc(item.id)) : String(item.id).trim();
}

function listRowId(raw: Record<string, unknown>): string | null {
  const id = raw.id;
  if (typeof id === "number" && Number.isFinite(id)) return String(Math.trunc(id));
  if (typeof id === "string" && /^\d+$/.test(id.trim())) return id.trim();
  return null;
}

function priceChanged(before: number | null, grossPrice: number): boolean {
  const prev = before != null ? Number(before) : NaN;
  return !Number.isFinite(prev) || prev !== grossPrice;
}

async function fetchManualListPage(
  url: string,
  referer: string,
  jar: Map<string, string>,
  session: MutableSession
): Promise<IponManualListPage> {
  const once = async (active: IponXhrSession) => {
    const res = await withTransientHttpRetry(
      "manual list products",
      () =>
        fetchWithSession(url, {
          jar,
          userAgent: IPON_IMPORT_USER_AGENT,
          referer,
          acceptJson: true,
          acceptLanguage: IPON_ACCEPT_LANGUAGE,
          origin: IPON_ORIGIN,
          extraHeaders: iponXhrHeaders(active)
        }),
      { isRetryableResponse: (response) => response.status === 502 || response.status === 503 || response.status === 504 }
    );
    const text = await res.text();
    if (looksLikeCaptchaOrBlock(text, res.status) || res.status === 429) {
      throw new IponCaptchaError("iPon list: captcha / blokada");
    }
    if (res.status === 403 && text.includes("xhr_token")) throw new IponXhrTokenError();
    if (!res.ok) throw new Error(`iPon list HTTP ${res.status}`);
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error("iPon list: odgovor nije JSON");
    }
    const parsed = parseIponManualListPage(json);
    if (!parsed) throw new Error("iPon list: odgovor nema items");
    return parsed;
  };

  session.current = await ensureIponXhrSession(jar, session.current);
  try {
    return await once(session.current);
  } catch (error) {
    if (!(error instanceof IponXhrTokenError)) throw error;
    session.current = await ensureIponXhrSession(jar, null, true);
    return once(session.current);
  }
}

async function loadTracking(
  ids: string[],
  jar: Map<string, string>,
  session: MutableSession
): Promise<{ products: Map<string, IponTrackingProduct>; failed: boolean }> {
  if (ids.length === 0) return { products: new Map(), failed: false };
  await sleep(CALL_GAP_MS);
  try {
    const batch = await fetchIponTrackingBatch(ids, jar, session.current);
    session.current = batch.session;
    const products = new Map<string, IponTrackingProduct>();
    for (const product of batch.products) products.set(product.id, product);
    return { products, failed: false };
  } catch (error) {
    console.warn(
      "[iPon manual] tracking:",
      error instanceof Error ? error.message : String(error)
    );
    return { products: new Map(), failed: true };
  }
}

async function refreshExistingOffer(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  item: IponProductItem,
  existing: ExistingOffer
): Promise<{ priceChanged: boolean; activeChanged: boolean; activated: boolean; imageChanged: boolean }> {
  const { data: product, error: productError } = await withPostgrestTransientRetry(
    "products.manual-lookup",
    async () => await supabase.from("products").select("name, brand").eq("id", productId).maybeSingle()
  );
  if (productError) throw new Error(`products lookup failed: ${productError.message}`);

  const productPatch: Record<string, unknown> = {};
  const nextName = item.displayName.trim();
  const currentName = typeof product?.name === "string" ? product.name.trim() : "";
  if (nextName && nextName !== currentName) productPatch.name = nextName;
  const currentBrand = typeof product?.brand === "string" ? product.brand.trim() : "";
  const nextBrand = typeof item.brand === "string" ? item.brand.trim() : "";
  if (!currentBrand && nextBrand) productPatch.brand = nextBrand;
  if (Object.keys(productPatch).length > 0) {
    productPatch.updated_at = new Date().toISOString();
    const { error } = await withPostgrestTransientRetry(
      "products.manual-update",
      async () => await supabase.from("products").update(productPatch).eq("id", productId)
    );
    if (error) throw new Error(`products update failed: ${error.message}`);
  }

  const active = manualOfferIsActive(item.isBuyable);
  const mergedRaw = mergeManualRawJson(existing.raw_json, item);
  const newPic = getFirstPictureUrl(item);
  const oldRaw =
    existing.raw_json && typeof existing.raw_json === "object" && !Array.isArray(existing.raw_json)
      ? (existing.raw_json as Record<string, unknown>)
      : null;
  const oldPic = getFirstPictureUrl(oldRaw);
  const imageChanged = Boolean(newPic && newPic !== oldPic);
  if (imageChanged) {
    const existingRaw =
      mergedRaw && typeof mergedRaw === "object" ? mergedRaw : null;
    await queueRescrapeAfterImageChange(supabase, productId, supplierProductId, item, existingRaw);
  }

  const patch: Record<string, unknown> = {
    price_amount: item.grossPrice,
    currency: "HUF",
    is_active: active,
    updated_at: new Date().toISOString()
  };
  const delivery = parseIponDeliveryDays(item);
  if (delivery != null) patch.delivery_days = delivery;
  if (!imageChanged) patch.raw_json = mergedRaw;

  const { error: offerError } = await withPostgrestTransientRetry(
    "supplier_products.manual-update",
    async () =>
      await supabase
        .from("supplier_products")
        .update(patch)
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
  );
  if (offerError) throw new Error(`supplier_products update failed: ${offerError.message}`);

  if (active) await deactivateOtherIponOffersForProduct(supabase, productId, supplierProductId);

  return {
    priceChanged: priceChanged(existing.price_amount, item.grossPrice),
    activeChanged: existing.is_active !== active,
    activated: existing.is_active === false && active,
    imageChanged
  };
}

async function upsertManualItem(
  supabase: SupabaseClient,
  item: IponProductItem,
  internalCategoryId: string,
  tallies: {
    imported: number;
    succeeded: number;
    updated: number;
    activated: number;
    imageChanged: number;
    rescrapeQueued: number;
  },
  aggregateIds: Set<string>,
  activeTouched: { current: boolean }
): Promise<void> {
  const supplierProductId = supplierIdOf(item);
  const { data: existing, error: lookupErr } = await withPostgrestTransientRetry(
    "supplier_products.manual-lookup",
    async () =>
      await supabase
        .from("supplier_products")
        .select("product_id, price_amount, is_active, raw_json")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
        .maybeSingle()
  );
  if (lookupErr) throw new Error(`supplier_products lookup failed: ${lookupErr.message}`);

  if (existing?.product_id) {
    const result = await refreshExistingOffer(
      supabase,
      existing.product_id,
      supplierProductId,
      item,
      existing as ExistingOffer
    );
    tallies.succeeded += 1;
    if (result.priceChanged || result.activeChanged) tallies.updated += 1;
    if (result.activated) tallies.activated += 1;
    if (result.imageChanged) {
      tallies.imageChanged += 1;
      tallies.rescrapeQueued += 1;
    }
    if (result.priceChanged || result.activeChanged || result.activated || manualOfferIsActive(item.isBuyable)) {
      aggregateIds.add(existing.product_id);
    }
    if (result.activeChanged || result.activated || !manualOfferIsActive(item.isBuyable)) {
      activeTouched.current = true;
    }
    return;
  }

  const linked = await insertOrLinkIponListItem(supabase, item, internalCategoryId);
  if (linked.outcome === "imported") {
    tallies.imported += 1;
    aggregateIds.add(linked.productId);
  } else {
    tallies.succeeded += 1;
    if (linked.priceChanged) tallies.updated += 1;
    if (linked.activated) tallies.activated += 1;
    if (linked.productId) aggregateIds.add(linked.productId);
  }
  if (!manualOfferIsActive(item.isBuyable)) activeTouched.current = true;
}

export async function runIponManualListImport(
  input: SupplierCategoryImportInput
): Promise<IponImportProductsResult> {
  const cat = buildIponCategoryFromSupplierRow(input);
  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();
  const session: MutableSession = { current: null };
  const filtered = listingUrlHasFilterParams(cat.url);

  console.log("[iPon manual] Warmup sesije:", cat.url);
  await warmupIponSessionForListing(jar, cat.url);
  await sleep(IPON_BEFORE_LIST_API_MS);

  const fetchedIds = new Set<string>();
  const aggregateIds = new Set<string>();
  const tallies = {
    imported: 0,
    succeeded: 0,
    updated: 0,
    activated: 0,
    imageChanged: 0,
    rescrapeQueued: 0
  };
  const activeTouched = { current: false };
  let wroteAny = false;
  let skipped = 0;
  let total: number | null = null;
  let lastPageShort = false;
  let errored = false;
  let firstError: unknown = null;
  let page = 1;

  while (page <= MAX_PAGES) {
    if (page > 1) await sleep(CALL_GAP_MS);

    let parsed: IponManualListPage;
    try {
      const url = buildIponListProductsUrl(cat.url, page, filtered, cat.supplierCategoryId);
      parsed = await fetchManualListPage(url, cat.url, jar, session);
    } catch (error) {
      errored = true;
      firstError = error;
      console.warn("[iPon manual] lista:", error instanceof Error ? error.message : String(error));
      break;
    }

    if (total == null && parsed.total != null) total = parsed.total;
    const pageSize = parsed.pageSize ?? DEFAULT_PAGE_SIZE;
    console.log("[iPon manual] Stranica", page, "—", parsed.itemCount, "stavki");

    if (parsed.itemCount === 0) {
      lastPageShort = true;
      break;
    }

    const pageIds = parsed.items.map(listRowId).filter((id): id is string => id != null);
    const tracking = await loadTracking(pageIds, jar, session);
    if (tracking.failed) {
      errored = true;
      if (!firstError) firstError = new Error("iPon tracking nije uspio");
    }

    try {
      for (const raw of parsed.items) {
        const merged = mergeManualListProduct(raw, tracking.products.get(listRowId(raw) ?? "") ?? null);
        if (!merged.ok) {
          skipped += 1;
          continue;
        }
        const id = supplierIdOf(merged.item);
        await upsertManualItem(supabase, merged.item, cat.internalCategoryId, tallies, aggregateIds, activeTouched);
        fetchedIds.add(id);
        wroteAny = true;
      }
    } catch (error) {
      errored = true;
      firstError = error;
      console.warn("[iPon manual] upis:", error instanceof Error ? error.message : String(error));
      break;
    }

    if (tracking.failed) break;
    if (parsed.itemCount < pageSize) {
      lastPageShort = true;
      break;
    }
    if (total != null && fetchedIds.size >= total) break;
    page += 1;
  }

  if (page > MAX_PAGES) {
    console.warn("[iPon manual] Dostignut limit stranica. Deaktivacija se preskače ako total nije pokriven.");
  }

  if (errored && !wroteAny) {
    throw firstError instanceof Error ? firstError : new Error("iPon lista: prva stranica nije uspjela");
  }

  const complete = isManualListImportComplete({
    errored,
    timedOut: false,
    total,
    fetchedCount: fetchedIds.size,
    lastPageShort
  });

  let deactivated = 0;
  if (complete) {
    const sweep = await deactivateInactiveIponInCategory(supabase, cat.internalCategoryId, fetchedIds);
    deactivated = sweep.deactivated;
    for (const productId of sweep.productIds) aggregateIds.add(productId);
    if (deactivated > 0) activeTouched.current = true;
  } else {
    console.warn(
      `[iPon manual] Nepotpun prolaz (total=${total ?? "?"}, fetched=${fetchedIds.size}). Deaktivacija preskočena.`
    );
  }

  if (activeTouched.current) {
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) console.warn("[iPon manual] reconcile:", rec.error);
  }

  let pricesAggregated = 0;
  let aggregateBatches = 0;
  let aggError: string | undefined;
  let aggWarnings: string[] | undefined;
  if (aggregateIds.size > 0) {
    const agg = await aggregatePricesForProductIds(Array.from(aggregateIds));
    pricesAggregated = agg.updated;
    aggregateBatches = agg.batches;
    aggError = agg.error;
    aggWarnings = agg.warnings;
    if (agg.error) console.warn("[iPon manual] aggregatePricesForProductIds:", agg.error);
  }

  console.log("[iPon manual] Jedna kategorija završena.", {
    category: cat.name,
    imported: tallies.imported,
    succeeded: tallies.succeeded,
    updated: tallies.updated,
    activated: tallies.activated,
    imageChanged: tallies.imageChanged,
    rescrapeQueued: tallies.rescrapeQueued,
    deactivated,
    skipped,
    incomplete: !complete,
    pricesUpdated: pricesAggregated
  });

  return {
    success: !aggError,
    imported: tallies.imported,
    succeeded: tallies.succeeded,
    updated: tallies.updated,
    activated: tallies.activated,
    deactivated,
    pricesAggregated,
    categoriesProcessed: 1,
    summary: {
      imported: tallies.imported,
      succeeded: tallies.succeeded,
      updated: tallies.updated,
      activated: tallies.activated,
      image_changed: tallies.imageChanged,
      rescrape_queued: tallies.rescrapeQueued,
      deactivated_offers: deactivated,
      prices_aggregated: pricesAggregated,
      aggregate_batches: aggregateBatches,
      categories_processed: 1,
      import_mode: "manual-list",
      single_category: true,
      category_name: cat.name,
      internal_category_id: cat.internalCategoryId,
      incomplete: !complete,
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
    }
  };
}
