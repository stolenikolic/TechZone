/**
 * iPon XML sync — cijene, delivery, globalna deaktivacija, aggregatePrices.
 * Run: npx tsx scripts/run-ipon-xml-sync.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { aggregatePrices, reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { IPON_SUPPLIER_ID } from "./categories";
import { parseIponXmlFeed, peekIponXmlFeedCreatedAt, type IponXmlFeedEntry } from "./xmlFeed";
import { withPostgrestTransientRetry } from "./transient-retry";

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Supabase/PostgREST default max rows per request — ne diži iznad 1000. */
const POSTGREST_MAX_ROWS = 1000;
const DB_PAGE_SIZE = Math.min(numEnv("IPON_XML_DB_PAGE_SIZE", POSTGREST_MAX_ROWS), POSTGREST_MAX_ROWS);
const UPDATE_BATCH_SIZE = numEnv("IPON_XML_BATCH_SIZE", 500);
const DEACTIVATE_CHUNK = numEnv("IPON_XML_DEACTIVATE_CHUNK", 100);
const PARALLEL_BATCHES = numEnv("IPON_XML_PARALLEL_BATCHES", 3);
const MIN_ITEMS = numEnv("IPON_XML_MIN_ITEMS", 100_000);

type DbOfferRow = {
  supplier_product_id: string;
  price_amount: number | null;
  delivery_days: number | null;
  is_active: boolean;
};

type PendingUpdate = {
  supplier_product_id: string;
  price_amount: number;
  delivery_days: number | null;
  reactivated: boolean;
};

async function fetchAllIponOffers(supabase: SupabaseClient): Promise<DbOfferRow[]> {
  const rows: DbOfferRow[] = [];
  let offset = 0;
  let pageNum = 0;

  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("xmlSync.fetchOffers", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id, price_amount, delivery_days, is_active")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE_SIZE - 1)
    );

    if (error) throw new Error(`xmlSync fetch offers: ${error.message}`);
    const page = (data ?? []) as DbOfferRow[];
    if (page.length === 0) break;

    pageNum += 1;
    rows.push(...page);
    offset += page.length;

    if (pageNum === 1 || pageNum % 5 === 0 || page.length < DB_PAGE_SIZE) {
      console.log(`[iPon XML] Učitano iz DB: ${rows.length} ponuda (stranica ${pageNum})`);
    }

    if (page.length < DB_PAGE_SIZE) break;
  }

  return rows;
}

function needsUpdate(row: DbOfferRow, feed: IponXmlFeedEntry): { changed: boolean; reactivated: boolean } {
  const prevPrice = row.price_amount != null ? Number(row.price_amount) : NaN;
  const priceChanged = !Number.isFinite(prevPrice) || prevPrice !== feed.price;

  const prevDelivery = row.delivery_days != null ? Number(row.delivery_days) : null;
  const deliveryChanged = prevDelivery !== feed.deliveryDays;

  const reactivated = row.is_active === false;
  const changed = priceChanged || deliveryChanged || reactivated;

  return { changed, reactivated };
}

async function runParallelBatches<T>(
  items: T[],
  batchSize: number,
  parallel: number,
  fn: (batch: T[], batchIndex: number) => Promise<void>
): Promise<void> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  let idx = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const batchIndex = idx;
      idx += 1;
      if (batchIndex >= batches.length) return;
      await fn(batches[batchIndex]!, batchIndex);
    }
  }

  const workers = Array.from({ length: Math.min(parallel, Math.max(1, batches.length)) }, () => worker());
  await Promise.all(workers);
}

async function applyUpdates(supabase: SupabaseClient, updates: PendingUpdate[]): Promise<number> {
  if (updates.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  let applied = 0;

  await runParallelBatches(updates, UPDATE_BATCH_SIZE, PARALLEL_BATCHES, async (batch) => {
    for (const row of batch) {
      const { error } = await withPostgrestTransientRetry("xmlSync.updateOffer", async () =>
        supabase
          .from("supplier_products")
          .update({
            price_amount: row.price_amount,
            currency: "HUF",
            delivery_days: row.delivery_days,
            is_active: true,
            updated_at: updatedAt
          })
          .eq("supplier_id", IPON_SUPPLIER_ID)
          .eq("supplier_product_id", row.supplier_product_id)
      );
      if (error) throw new Error(`xmlSync update ${row.supplier_product_id}: ${error.message}`);
      applied += 1;
    }
  });

  return applied;
}

async function deactivateInactiveIponGlobally(
  supabase: SupabaseClient,
  fetchedIds: Set<string>
): Promise<number> {
  const staleIds: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("xmlSync.activeOffers", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("is_active", true)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE_SIZE - 1)
    );

    if (error) throw new Error(`xmlSync deactivate scan: ${error.message}`);

    const page = (data ?? []) as Array<{ supplier_product_id: string }>;
    if (page.length === 0) break;

    for (const row of page) {
      const id = String(row.supplier_product_id);
      if (!fetchedIds.has(id)) staleIds.push(id);
    }

    offset += page.length;
    if (page.length < DB_PAGE_SIZE) break;
  }

  if (staleIds.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  let deactivated = 0;

  for (let i = 0; i < staleIds.length; i += DEACTIVATE_CHUNK) {
    const chunk = staleIds.slice(i, i + DEACTIVATE_CHUNK);
    const { error: uErr } = await withPostgrestTransientRetry("xmlSync.deactivate", async () =>
      supabase
        .from("supplier_products")
        .update({ is_active: false, updated_at: updatedAt })
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .in("supplier_product_id", chunk)
    );
    if (uErr) throw new Error(`xmlSync deactivate: ${uErr.message}`);
    deactivated += chunk.length;
  }

  if (deactivated > 0) {
    console.log(`[iPon XML] Deaktivirano ${deactivated} ponuda (nema u feedu).`);
  }

  return deactivated;
}

export type IponXmlSyncResult = {
  success: boolean;
  parsed: number;
  dbOffers: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  skippedNotInDb: number;
  pricesAggregated: number;
  summary?: Record<string, unknown>;
};

export async function runIponXmlSync(): Promise<IponXmlSyncResult> {
  const feedUrl = process.env.IPON_XML_FEED_URL?.trim();
  const fixture = process.env.IPON_XML_FIXTURE?.trim();

  if (!feedUrl && !fixture) {
    throw new Error("Postavi IPON_XML_FEED_URL ili IPON_XML_FIXTURE u .env.local");
  }

  console.log("[iPon XML] Parsiranje feeda…", fixture ? `fixture: ${fixture}` : feedUrl);

  const feedCreatedAt = await peekIponXmlFeedCreatedAt({
    feedUrl: fixture ? undefined : feedUrl,
    fixturePath: fixture || undefined
  });
  if (feedCreatedAt) {
    console.log("[iPon XML] Feed CreatedAt:", feedCreatedAt);
  } else {
    console.log("[iPon XML] Feed CreatedAt: (nije pronađen u zaglavlju)");
  }

  let lastProgress = 0;
  const feedMap = await parseIponXmlFeed(feedUrl ?? "file://fixture", {
    fixturePath: fixture || undefined,
    onProgress: (n) => {
      if (n - lastProgress >= 25_000) {
        console.log("[iPon XML] Parsirano stavki:", n);
        lastProgress = n;
      }
    }
  });

  const parsed = feedMap.size;
  console.log("[iPon XML] Ukupno u feedu:", parsed);

  if (parsed < MIN_ITEMS) {
    throw new Error(
      `[iPon XML] Guard: feed ima samo ${parsed} stavki (min ${MIN_ITEMS}) — abort bez DB izmjena.`
    );
  }

  const supabase = createSupabaseServiceClient();
  const dbOffers = await fetchAllIponOffers(supabase);
  console.log("[iPon XML] iPon ponuda u DB:", dbOffers.length);

  const dbIdSet = new Set(dbOffers.map((r) => String(r.supplier_product_id)));
  let feedNotInDb = 0;
  for (const id of Array.from(feedMap.keys())) {
    if (!dbIdSet.has(id)) feedNotInDb += 1;
  }

  const updates: PendingUpdate[] = [];
  let reactivated = 0;

  for (const row of dbOffers) {
    const feed = feedMap.get(String(row.supplier_product_id));
    if (!feed) continue;

    const { changed, reactivated: wasInactive } = needsUpdate(row, feed);
    if (!changed) continue;

    if (wasInactive) reactivated += 1;
    updates.push({
      supplier_product_id: String(row.supplier_product_id),
      price_amount: feed.price,
      delivery_days: feed.deliveryDays,
      reactivated: wasInactive
    });
  }

  const updated = await applyUpdates(supabase, updates);
  const deactivated = await deactivateInactiveIponGlobally(supabase, new Set(feedMap.keys()));

  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[iPon XML] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  const agg = await aggregatePrices();

  const result: IponXmlSyncResult = {
    success: !agg.error,
    parsed,
    dbOffers: dbOffers.length,
    updated,
    reactivated,
    deactivated,
    skippedNotInDb: feedNotInDb,
    pricesAggregated: agg.updated,
    summary: {
      parsed,
      db_offers: dbOffers.length,
      updated,
      reactivated,
      deactivated,
      feed_not_in_db: feedNotInDb,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };

  console.log("[iPon XML] Završeno.", result.summary);
  return result;
}
