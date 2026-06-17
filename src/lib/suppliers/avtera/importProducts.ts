/**
 * Avtera: XML import novih supplier_products (offer-only, pilot kategorija MS).
 * Run: npx tsx scripts/run-avtera-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { mergeMatchAudit, resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn, mpnMatchKeyFromMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { getSupplierCategories } from "lib/suppliers/registry";
import { createSupabaseServiceClient } from "utils/supabase";
import { AVTERA_CATEGORIES, AVTERA_SUPPLIER_ID, type AvteraCategory } from "./categories";
import { resolveAvteraPrice } from "./parsePrice";
import { deliveryDaysForZaloga, isAvteraActiveFromZaloga } from "./parseStock";
import { withPostgrestTransientRetry } from "./transient-retry";
import { buildAvteraRawJson, buildAvteraSpecSnapshot } from "./transform";
import type { AvteraProduct } from "./types";
import {
  assertAvteraFeedGuard,
  countAvteraIzdelekInFeed,
  filterProductsByCategory,
  parseAvteraXmlFeedFull
} from "./xmlFeed";

const LOG = "[Avtera import]";

function feedOptions() {
  const fixture = process.env.AVTERA_XML_FIXTURE?.trim();
  const feedUrl = process.env.AVTERA_XML_FEED_URL?.trim();
  if (!fixture && !feedUrl) {
    throw new Error("Postavi AVTERA_XML_FEED_URL ili AVTERA_XML_FIXTURE u .env.local");
  }
  return { fixturePath: fixture || undefined, feedUrl: fixture ? undefined : feedUrl };
}

async function resolveAvteraCategoriesFromRegistry(): Promise<AvteraCategory[]> {
  const rows = await getSupplierCategories(AVTERA_SUPPLIER_ID);
  if (rows.length === 0) return AVTERA_CATEGORIES.filter((c) => c.internalCategoryId || c.categoryId);

  const out: AvteraCategory[] = [];
  for (const row of rows) {
    const key = row.supplierCategoryKey?.trim();
    if (!key) continue;
    const fallback = AVTERA_CATEGORIES.find((c) => c.categoryId === key);
    const internalCategoryId = row.internalCategoryId || fallback?.internalCategoryId || "";
    if (!internalCategoryId) continue;
    out.push({
      categoryId: key,
      internalCategoryId,
      label: fallback?.label ?? key
    });
  }

  return out.length > 0 ? out : AVTERA_CATEGORIES.filter((c) => c.categoryId);
}

async function loadExistingSupplierProductIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Set<string>> {
  const existing = new Set<string>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await withPostgrestTransientRetry("avtera.existingIds", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", AVTERA_SUPPLIER_ID)
        .in("supplier_product_id", slice)
    );
    if (error) throw new Error(`Avtera existing ids lookup: ${error.message}`);
    for (const row of data ?? []) {
      existing.add(String(row.supplier_product_id));
    }
  }
  return existing;
}

export type AvteraCategoryImportStats = {
  categoryId: string;
  scanned: number;
  upserted: number;
  skippedExisting: number;
  skippedNoPrice: number;
  skippedNoId: number;
};

async function importCategoryGroup(
  supabase: SupabaseClient,
  category: AvteraCategory,
  products: AvteraProduct[],
  existingIds: Set<string>
): Promise<AvteraCategoryImportStats> {
  const stats: AvteraCategoryImportStats = {
    categoryId: category.categoryId,
    scanned: products.length,
    upserted: 0,
    skippedExisting: 0,
    skippedNoPrice: 0,
    skippedNoId: 0
  };

  const existingInGroup = products.filter((p) => existingIds.has(p.izdelekID)).length;
  const newCandidates = stats.scanned - existingInGroup;

  console.log(
    `${LOG} Kategorija ${category.categoryId} (${category.label}): ${stats.scanned} u feedu, ${existingInGroup} već u DB, ${newCandidates} novih kandidata`
  );

  for (const product of products) {
    const izdelekID = product.izdelekID?.trim();
    if (!izdelekID) {
      stats.skippedNoId += 1;
      continue;
    }

    if (existingIds.has(izdelekID)) {
      stats.skippedExisting += 1;
      continue;
    }

    const priceAmount = resolveAvteraPrice(product);
    if (priceAmount == null) {
      stats.skippedNoPrice += 1;
      console.warn(`${LOG} Skip (no price):`, izdelekID, product.izdelekIme?.slice(0, 60) ?? "");
      continue;
    }

    const mpnN = normalizeMpn(product.vendorItemNo);
    const eanN = normalizeEan(product.ean);
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
        throw new Error(`Avtera products identifiers lookup: ${masterIdentifiersError.message}`);
      }
      const identifierSync = getIdentifierSyncUpdate(
        { mpn: mpnN, ean: eanN },
        { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
      );
      resolvedMpn = identifierSync.update.mpn ?? mpnN;
      resolvedEan = identifierSync.update.ean ?? eanN;
    }

    const specSnapshot = buildAvteraSpecSnapshot(product, resolvedMpn, resolvedEan);
    const isActive = isAvteraActiveFromZaloga(product.zaloga);
    const now = new Date().toISOString();

    const rawJson = mergeMatchAudit(buildAvteraRawJson({ product }), match.audit);

    const row = {
      supplier_id: AVTERA_SUPPLIER_ID,
      supplier_product_id: izdelekID,
      product_id: productId,
      price_amount: priceAmount,
      currency: "KM",
      mpn: resolvedMpn,
      mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
      ean: resolvedEan,
      delivery_days: deliveryDaysForZaloga(product.zaloga),
      warranty_months: null,
      is_active: isActive,
      enrichment_status: "complete" as const,
      master_match_status: productId ? ("linked" as const) : ("pending_review" as const),
      raw_json: rawJson,
      spec_snapshot: specSnapshot,
      specs_fetched_at: now,
      updated_at: now
    };

    const { error: upErr } = await withPostgrestTransientRetry("avtera.upsert", async () =>
      supabase.from("supplier_products").upsert(row, {
        onConflict: "supplier_id,supplier_product_id"
      })
    );
    if (upErr) throw new Error(`Avtera supplier_products upsert: ${upErr.message}`);

    existingIds.add(izdelekID);
    stats.upserted += 1;
    console.log(
      `${LOG} ${category.label} — ${(product.izdelekIme ?? "").slice(0, 60)} id=${izdelekID} ean=${eanN ?? "(null)"} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} KM zaloga=${product.zaloga} active=${isActive} specs=${specSnapshot.specs.length}`
    );
  }

  console.log(`${LOG} Kategorija ${category.categoryId} (${category.label}) završena.`, stats);
  return stats;
}

export type AvteraImportResult = {
  success: boolean;
  error?: string;
  summary?: {
    categories: number;
    feed_items: number;
    scanned: number;
    upserted: number;
    skipped_existing: number;
    skipped_no_price: number;
    skipped_no_id: number;
  };
};

export type AvteraSupplierCategoryImportInput = {
  categoryId: string;
  internalCategoryId?: string;
  name?: string;
};

export type AvteraSingleCategoryImportResult = {
  success: boolean;
  upserted: number;
  skippedExisting: number;
  summary: Record<string, unknown>;
};

export async function runAvteraImportForSupplierCategory(
  input: AvteraSupplierCategoryImportInput
): Promise<AvteraSingleCategoryImportResult> {
  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    throw new Error("supplier_category_key (kategorija/@id) je obavezan za Avtera import.");
  }

  const supabase = createSupabaseServiceClient();
  const opts = feedOptions();

  console.log(`${LOG} Jedna kategorija: kategorija/@id=${categoryId}`);

  const feedCount = await countAvteraIzdelekInFeed(opts);
  assertAvteraFeedGuard(feedCount);

  const allProducts = await parseAvteraXmlFeedFull(opts);
  const categoryProducts = filterProductsByCategory(allProducts, categoryId);

  const category: AvteraCategory = {
    categoryId,
    internalCategoryId:
      input.internalCategoryId?.trim() ||
      AVTERA_CATEGORIES.find((c) => c.categoryId === categoryId)?.internalCategoryId ||
      "",
    label: input.name ?? categoryId
  };

  const ids = categoryProducts.map((p) => p.izdelekID);
  const existingIds = await loadExistingSupplierProductIds(supabase, ids);
  console.log(`${LOG} Postojećih u DB (u ovoj kategoriji): ${existingIds.size}`);

  const stats = await importCategoryGroup(supabase, category, categoryProducts, existingIds);
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) console.warn(`${LOG} reconcile:`, rec.error);

  const summary = {
    single_category: true,
    category_id: categoryId,
    feed_items: feedCount,
    scanned: stats.scanned,
    upserted: stats.upserted,
    skipped_existing: stats.skippedExisting,
    skipped_no_price: stats.skippedNoPrice,
    skipped_no_id: stats.skippedNoId
  };
  console.log(`${LOG} Jedna kategorija završena.`, summary);

  return {
    success: true,
    upserted: stats.upserted,
    skippedExisting: stats.skippedExisting,
    summary
  };
}

export async function runAvteraImportProducts(): Promise<AvteraImportResult> {
  const supabase = createSupabaseServiceClient();
  const summary = {
    categories: 0,
    feed_items: 0,
    scanned: 0,
    upserted: 0,
    skipped_existing: 0,
    skipped_no_price: 0,
    skipped_no_id: 0
  };

  try {
    console.log(`${LOG} Pokretanje punog importa…`);
    const opts = feedOptions();

    const categories = await resolveAvteraCategoriesFromRegistry();
    summary.categories = categories.length;
    console.log(
      `${LOG} Kategorije (${categories.length}):`,
      categories.map((c) => `${c.categoryId}→${c.internalCategoryId}`).join(", ")
    );

    if (categories.length === 0) {
      throw new Error("Nema aktivnih Avtera kategorija u supplier_categories.");
    }

    const feedCount = await countAvteraIzdelekInFeed(opts);
    summary.feed_items = feedCount;
    assertAvteraFeedGuard(feedCount);

    const allProducts = await parseAvteraXmlFeedFull(opts);
    console.log(`${LOG} Parsirano u feedu: ${allProducts.size} (guard count: ${feedCount})`);

    const allIds = Array.from(allProducts.keys());
    const existingIds = await loadExistingSupplierProductIds(supabase, allIds);
    console.log(`${LOG} Postojećih u DB (sve kategorije): ${existingIds.size}`);

    for (const category of categories) {
      const categoryProducts = filterProductsByCategory(allProducts, category.categoryId);
      const stats = await importCategoryGroup(supabase, category, categoryProducts, existingIds);
      summary.scanned += stats.scanned;
      summary.upserted += stats.upserted;
      summary.skipped_existing += stats.skippedExisting;
      summary.skipped_no_price += stats.skippedNoPrice;
      summary.skipped_no_id += stats.skippedNoId;
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
