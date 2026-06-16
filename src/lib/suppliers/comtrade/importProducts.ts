/**
 * ComTrade: API import novih supplier_products (offer-only, pilot productGroupID).
 * Run: npx tsx scripts/run-comtrade-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { mergeMatchAudit, resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn, mpnMatchKeyFromMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { getSupplierCategories } from "lib/suppliers/registry";
import { createSupabaseServiceClient } from "utils/supabase";
import { createComtradeApiClient } from "./api-client";
import { COMTRADE_CATEGORIES, COMTRADE_SUPPLIER_ID, type ComtradeCategory } from "./categories";
import { clearComtradeTokenCache } from "./auth";
import { isComtradeInStockFromQuantity, parseComtradeQuantity } from "./parseQuantity";
import { extractComtradeWarrantyMonths } from "./parseWarranty";
import { withPostgrestTransientRetry } from "./transient-retry";
import {
  buildComtradeImageUrls,
  buildComtradeRawJson,
  buildComtradeSpecSnapshot,
  resolveComtradeListPrice
} from "./transform";
import type { ComtradePriceItem } from "./types";

const LOG = "[ComTrade import]";

function logCategorySummary(label: string, stats: ComtradeCategoryImportStats) {
  console.log(`${LOG} Grupa ${stats.groupId} (${label}) završena.`, {
    scanned: stats.scanned,
    upserted: stats.upserted,
    skipped_existing: stats.skippedExisting,
    skipped_no_price: stats.skippedNoPrice,
    skipped_no_product_no: stats.skippedNoProductNo
  });
}

function deliveryDaysForQty(qty: number): number | null {
  return qty > 0 ? 1 : null;
}

function isActiveFromListAndDetail(
  listQty: number,
  detailReserved: boolean | undefined
): boolean {
  if (listQty <= 0) return false;
  if (detailReserved === true) return false;
  return true;
}

async function resolveComtradeCategoriesFromRegistry(): Promise<ComtradeCategory[]> {
  const rows = await getSupplierCategories(COMTRADE_SUPPLIER_ID);
  if (rows.length === 0) return COMTRADE_CATEGORIES;
  const out: ComtradeCategory[] = [];
  for (const row of rows) {
    const key = row.supplierCategoryKey?.trim();
    if (!key) continue;
    const fallback = COMTRADE_CATEGORIES.find((c) => c.productGroupId === key);
    out.push({
      productGroupId: key,
      internalCategoryId: row.internalCategoryId || fallback?.internalCategoryId || "",
      label: fallback?.label ?? key
    });
  }
  return out.length > 0 ? out.filter((c) => c.internalCategoryId) : COMTRADE_CATEGORIES;
}

async function loadExistingSupplierProductIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Set<string>> {
  const existing = new Set<string>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await withPostgrestTransientRetry("comtrade.existingIds", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", COMTRADE_SUPPLIER_ID)
        .in("supplier_product_id", slice)
    );
    if (error) throw new Error(`ComTrade existing ids lookup: ${error.message}`);
    for (const row of data ?? []) {
      existing.add(String(row.supplier_product_id));
    }
  }
  return existing;
}

export type ComtradeCategoryImportStats = {
  groupId: string;
  scanned: number;
  upserted: number;
  skippedExisting: number;
  skippedNoPrice: number;
  skippedNoProductNo: number;
};

async function importCategoryGroup(
  supabase: SupabaseClient,
  category: ComtradeCategory,
  items: ComtradePriceItem[],
  existingIds: Set<string>
): Promise<ComtradeCategoryImportStats> {
  const stats: ComtradeCategoryImportStats = {
    groupId: category.productGroupId,
    scanned: 0,
    upserted: 0,
    skippedExisting: 0,
    skippedNoPrice: 0,
    skippedNoProductNo: 0
  };

  const client = createComtradeApiClient();
  await client.ensureAuth();

  const groupItems = items.filter((i) => i.productGroupID === category.productGroupId);
  stats.scanned = groupItems.length;

  const existingInGroup = groupItems.filter((i) => {
    const id = i.productNo?.trim() || i.productID?.trim();
    return id && existingIds.has(id);
  }).length;
  const newCandidates = stats.scanned - existingInGroup;

  console.log(
    `${LOG} Grupa ${category.productGroupId} (${category.label}): ${stats.scanned} u listi, ${existingInGroup} već u DB, ${newCandidates} novih kandidata`
  );

  for (const item of groupItems) {
    const productNo = item.productNo?.trim() || item.productID?.trim();
    if (!productNo) {
      stats.skippedNoProductNo += 1;
      console.warn(`${LOG} Skip (no productNo):`, item.productName?.slice(0, 60) ?? "(unnamed)");
      continue;
    }

    if (existingIds.has(productNo)) {
      stats.skippedExisting += 1;
      continue;
    }

    const priceAmount = resolveComtradeListPrice(item);
    if (priceAmount == null) {
      stats.skippedNoPrice += 1;
      console.warn(`${LOG} Skip (no price):`, productNo, item.productName?.slice(0, 60) ?? "");
      continue;
    }

    const listQty = parseComtradeQuantity(item.quantity);
    console.log(`${LOG} Detalj ${productNo}… (qty=${item.quantity ?? "?"}, partnerPrice=${priceAmount})`);
    const detail = await client.fetchProduct(productNo);
    const specs = await client.fetchProductSpecs(productNo);
    const images = await client.fetchProductImages(productNo);
    const imageUrls = buildComtradeImageUrls(images);

    const mpnN = normalizeMpn(productNo);
    const eanN = normalizeEan(item.barCode || detail?.barCode);
    const match = await resolveSupplierProductMatch(supabase, { ean: eanN, mpn: mpnN });
    const productId = match.productId;

    let resolvedMpn = mpnN;
    let resolvedEan = eanN;
    if (productId) {
      const { data: masterIdentifiers, error: masterIdentifiersError } = await supabase
        .from("products")
        .select("mpn, ean")
        .eq("id", productId)
        .maybeSingle();
      if (masterIdentifiersError) {
        throw new Error(`ComTrade products identifiers lookup: ${masterIdentifiersError.message}`);
      }
      const identifierSync = getIdentifierSyncUpdate(
        { mpn: mpnN, ean: eanN },
        { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
      );
      resolvedMpn = identifierSync.update.mpn ?? mpnN;
      resolvedEan = identifierSync.update.ean ?? eanN;
    }

    const specSnapshot = buildComtradeSpecSnapshot(detail, specs, resolvedMpn, resolvedEan);
    const warrantyMonths = extractComtradeWarrantyMonths(specSnapshot.specs);
    const isActive = isActiveFromListAndDetail(listQty, detail?.isReserved);
    const now = new Date().toISOString();

    const rawJson = mergeMatchAudit(
      buildComtradeRawJson({
        listItem: item,
        detail,
        imageUrls,
        productGroupId: category.productGroupId
      }),
      match.audit
    );

    const row = {
      supplier_id: COMTRADE_SUPPLIER_ID,
      supplier_product_id: productNo,
      product_id: productId,
      price_amount: priceAmount,
      currency: "KM",
      mpn: resolvedMpn,
      mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
      ean: resolvedEan,
      delivery_days: deliveryDaysForQty(listQty),
      warranty_months: warrantyMonths,
      is_active: isActive,
      enrichment_status: "complete" as const,
      master_match_status: productId ? ("linked" as const) : ("pending_review" as const),
      raw_json: rawJson,
      spec_snapshot: specSnapshot,
      specs_fetched_at: now,
      updated_at: now
    };

    const { error: upErr } = await withPostgrestTransientRetry("comtrade.upsert", async () =>
      supabase.from("supplier_products").upsert(row, {
        onConflict: "supplier_id,supplier_product_id"
      })
    );
    if (upErr) throw new Error(`ComTrade supplier_products upsert: ${upErr.message}`);

    existingIds.add(productNo);
    stats.upserted += 1;
    const reserved = detail?.isReserved === true;
    console.log(
      `${LOG} ${category.label} — ${item.productName.slice(0, 60)} id=${productNo} ean=${eanN ?? "(null)"} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} KM qty=${listQty} active=${isActive} reserved=${reserved} warranty=${warrantyMonths ?? "-"} images=${imageUrls.length} specs=${specSnapshot.specs.length}`
    );
  }

  logCategorySummary(category.label, stats);
  return stats;
}

export type ComtradeImportResult = {
  success: boolean;
  error?: string;
  summary?: {
    categories: number;
    scanned: number;
    upserted: number;
    skipped_existing: number;
    skipped_no_price: number;
    skipped_no_product_no: number;
  };
};

export type ComtradeSupplierCategoryImportInput = {
  productGroupId: string;
  internalCategoryId?: string;
  name?: string;
};

export type ComtradeSingleCategoryImportResult = {
  success: boolean;
  upserted: number;
  skippedExisting: number;
  summary: Record<string, unknown>;
};

export async function runComtradeImportForSupplierCategory(
  input: ComtradeSupplierCategoryImportInput
): Promise<ComtradeSingleCategoryImportResult> {
  const productGroupId = input.productGroupId.trim();
  if (!productGroupId) {
    throw new Error("supplier_category_key (productGroupID) je obavezan za ComTrade import.");
  }

  clearComtradeTokenCache();
  const supabase = createSupabaseServiceClient();

  console.log(`${LOG} Jedna kategorija: productGroupID=${productGroupId}`);

  const client = createComtradeApiClient();
  console.log(`${LOG} Login…`);
  await client.ensureAuth();
  console.log(`${LOG} Login OK`);

  const allItems = await client.fetchPriceItems();
  console.log(`${LOG} /Price/items ukupno: ${allItems.length}`);

  const category: ComtradeCategory = {
    productGroupId,
    internalCategoryId:
      input.internalCategoryId?.trim() ||
      COMTRADE_CATEGORIES.find((c) => c.productGroupId === productGroupId)?.internalCategoryId ||
      "",
    label: input.name ?? productGroupId
  };

  const productNos = allItems
    .filter((i) => i.productGroupID === productGroupId)
    .map((i) => i.productNo?.trim() || i.productID?.trim())
    .filter(Boolean) as string[];
  const existingIds = await loadExistingSupplierProductIds(supabase, productNos);
  console.log(`${LOG} Postojećih u DB (u ovoj grupi): ${existingIds.size}`);

  const stats = await importCategoryGroup(supabase, category, allItems, existingIds);
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) console.warn(`${LOG} reconcile:`, rec.error);

  const summary = {
    single_category: true,
    product_group_id: productGroupId,
    scanned: stats.scanned,
    upserted: stats.upserted,
    skipped_existing: stats.skippedExisting,
    skipped_no_price: stats.skippedNoPrice,
    skipped_no_product_no: stats.skippedNoProductNo
  };
  console.log(`${LOG} Jedna kategorija završena.`, summary);

  return {
    success: true,
    upserted: stats.upserted,
    skippedExisting: stats.skippedExisting,
    summary
  };
}

export async function runComtradeImportProducts(): Promise<ComtradeImportResult> {
  clearComtradeTokenCache();
  const supabase = createSupabaseServiceClient();
  const summary = {
    categories: 0,
    scanned: 0,
    upserted: 0,
    skipped_existing: 0,
    skipped_no_price: 0,
    skipped_no_product_no: 0
  };

  try {
    console.log(`${LOG} Pokretanje punog importa…`);

    const categories = await resolveComtradeCategoriesFromRegistry();
    summary.categories = categories.length;
    console.log(
      `${LOG} Kategorije (${categories.length}):`,
      categories.map((c) => `${c.productGroupId}→${c.internalCategoryId}`).join(", ")
    );

    const client = createComtradeApiClient();
    console.log(`${LOG} Login…`);
    await client.ensureAuth();
    console.log(`${LOG} Login OK`);

    const allItems = await client.fetchPriceItems();
    console.log(`${LOG} /Price/items ukupno: ${allItems.length}`);

    const allProductNos = allItems
      .map((i) => i.productNo?.trim() || i.productID?.trim())
      .filter(Boolean) as string[];
    const existingIds = await loadExistingSupplierProductIds(supabase, allProductNos);
    console.log(`${LOG} Postojećih u DB (sve grupe): ${existingIds.size}`);

    for (const category of categories) {
      const stats = await importCategoryGroup(supabase, category, allItems, existingIds);
      summary.scanned += stats.scanned;
      summary.upserted += stats.upserted;
      summary.skipped_existing += stats.skippedExisting;
      summary.skipped_no_price += stats.skippedNoPrice;
      summary.skipped_no_product_no += stats.skippedNoProductNo;
    }

    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) console.warn(`${LOG} reconcile:`, rec.error);

    console.log(`${LOG} Završeno.`, summary);
    return { success: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG}`, message);
    return { success: false, error: message, summary };
  }
}

export { isComtradeInStockFromQuantity, parseComtradeQuantity };
