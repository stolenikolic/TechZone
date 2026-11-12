/**
 * Nightly iPon discovery: Árukereső feed diff, English productGroup, tracking API.
 * Does not crawl /shop/group/.../product/data. Does not update existing offers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  classifyFeedProduct,
  needsListCheck,
  ownersForProductGroup,
  type IponMappedCategory
} from "./classifyFeedProduct";
import { IPON_SUPPLIER_ID } from "./constants";
import {
  aggregateDiscoveryNewProductPrices,
  insertOrLinkIponListItem,
  type IponImportProductsResult
} from "./importProducts";
import { retryIponPicturesMissingHosted } from "./ipon-product-images";
import { IponCaptchaError, numEnv } from "./ipon-fetch";
import { learnProductGroups } from "./learnProductGroups";
import { loadIponMappedCategories, syncFilteredCategoryMembership } from "./listMembership";
import {
  DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS,
  DEFAULT_IPON_PRODUCT_FEED_URL,
  streamIponProductFeed,
  toIponEnglishProductUrl,
  type IponFeedProduct
} from "./productFeed";
import {
  IPON_TRACKING_BATCH_SIZE,
  fetchIponTrackingBatch,
  pauseBetweenIponCalls,
  type IponTrackingProduct
} from "./trackingApi";
import { withPostgrestTransientRetry } from "./transient-retry";
import type { IponProductItem } from "./transformProduct";
import type { IponXhrSession } from "./xhrToken";

const DB_PAGE = 1000;
const DB_CHUNK = 200;
const UNKNOWN_NAME_LIMIT = 30;

type FeedSnapshot = {
  name: string | null;
  ean: string | null;
  product_number: string | null;
  manufacturer: string | null;
  image_url: string | null;
  product_url: string | null;
  category: string | null;
  price: number | null;
};

type PendingRow = {
  supplier_product_id: string;
  first_seen_at: string;
  attempts: number;
  unclassified_checks: number;
  last_membership_proof_at: string | null;
  product_group: string | null;
  reason: string | null;
  feed_snapshot: FeedSnapshot | null;
};

type MutableSession = { current: IponXhrSession | null };

type UnknownGroupReport = { count: number; names: string[] };

export type RunIponFeedDiscoveryOptions = {
  dryRun?: boolean;
  /** 0 or less means no cap. The run stops when iPon blocks. */
  budget?: number;
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function snapshotOf(product: IponFeedProduct): FeedSnapshot {
  return {
    name: product.name,
    ean: product.ean,
    product_number: product.productNumber,
    manufacturer: product.manufacturer,
    image_url: product.imageUrl,
    product_url: product.productUrl,
    category: product.categoryPath,
    price: product.price
  };
}

function feedFromSnapshot(id: string, snapshot: FeedSnapshot | null): IponFeedProduct | null {
  if (!snapshot) return null;
  return {
    identifier: id,
    name: snapshot.name,
    imageUrl: snapshot.image_url,
    ean: snapshot.ean,
    productNumber: snapshot.product_number,
    manufacturer: snapshot.manufacturer,
    productUrl: snapshot.product_url,
    categoryPath: snapshot.category,
    price: snapshot.price
  };
}

function noteUnknown(report: Map<string, UnknownGroupReport>, productGroup: string | null, articleName: string): void {
  const key = productGroup?.trim() || "(bez naziva)";
  const entry = report.get(key) ?? { count: 0, names: [] };
  entry.count += 1;
  const name = articleName.trim();
  if (name && entry.names.length < UNKNOWN_NAME_LIMIT && !entry.names.includes(name)) entry.names.push(name);
  report.set(key, entry);
}

async function loadSupplierProductIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("discovery.supplier-ids", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`supplier_products ids: ${error.message}`);
    const page = (data ?? []) as Array<{ supplier_product_id: string | null }>;
    for (const row of page) {
      if (row.supplier_product_id) ids.add(String(row.supplier_product_id));
    }
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }
  return ids;
}

async function loadPendingIdSet(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("discovery.pending-ids", async () =>
      supabase
        .from("ipon_feed_pending")
        .select("supplier_product_id")
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`ipon_feed_pending ids: ${error.message}`);
    const page = (data ?? []) as Array<{ supplier_product_id: string }>;
    for (const row of page) ids.add(String(row.supplier_product_id));
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }
  return ids;
}

async function syncPendingTable(supabase: SupabaseClient, missing: Map<string, IponFeedProduct>): Promise<void> {
  const pendingIds = await loadPendingIdSet(supabase);
  const stale: string[] = [];
  pendingIds.forEach((id) => {
    if (!missing.has(id)) stale.push(id);
  });
  for (const part of chunks(stale, DB_CHUNK)) {
    const { error } = await supabase.from("ipon_feed_pending").delete().in("supplier_product_id", part);
    if (error) throw new Error(`ipon_feed_pending delete: ${error.message}`);
  }

  const fresh: IponFeedProduct[] = [];
  missing.forEach((product, id) => {
    if (!pendingIds.has(id)) fresh.push(product);
  });
  let inserted = 0;
  for (const part of chunks(fresh, DB_CHUNK)) {
    const rows = part.map((product) => ({
      supplier_product_id: product.identifier,
      status: "pending",
      reason: null,
      attempts: 0,
      unclassified_checks: 0,
      candidate_category_ids: [],
      feed_snapshot: snapshotOf(product)
    }));
    const { error } = await supabase.from("ipon_feed_pending").insert(rows);
    if (error) throw new Error(`ipon_feed_pending insert: ${error.message}`);
    inserted += part.length;
    if (inserted % 2000 === 0 || inserted === fresh.length) {
      console.log(`[iPon discovery] Pending novi redovi: ${inserted}/${fresh.length}`);
    }
  }
  if (stale.length > 0) console.log(`[iPon discovery] Pending obrisano (više nisu novi): ${stale.length}`);
}

const PENDING_COLUMNS =
  "supplier_product_id, first_seen_at, attempts, unclassified_checks, last_membership_proof_at, product_group, reason, feed_snapshot";

async function loadActivePending(supabase: SupabaseClient, limit: number): Promise<PendingRow[]> {
  const { data, error } = await withPostgrestTransientRetry("discovery.pending-batch", async () =>
    supabase
      .from("ipon_feed_pending")
      .select(PENDING_COLUMNS)
      .in("status", ["pending", "no_tracking"])
      .or("reason.is.null,reason.neq.unknown_group")
      .order("last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(limit)
  );
  if (error) throw new Error(`ipon_feed_pending batch: ${error.message}`);
  return (data ?? []) as PendingRow[];
}

async function loadPromotedPending(
  supabase: SupabaseClient,
  groups: string[],
  limit: number
): Promise<PendingRow[]> {
  if (groups.length === 0 || limit <= 0) return [];
  const rows: PendingRow[] = [];
  for (const part of chunks(groups, 50)) {
    if (rows.length >= limit) break;
    const { data, error } = await withPostgrestTransientRetry("discovery.pending-promoted", async () =>
      supabase
        .from("ipon_feed_pending")
        .select(PENDING_COLUMNS)
        .eq("reason", "unknown_group")
        .in("product_group", part)
        .order("last_attempt_at", { ascending: true, nullsFirst: true })
        .limit(limit - rows.length)
    );
    if (error) throw new Error(`ipon_feed_pending promoted: ${error.message}`);
    rows.push(...((data ?? []) as PendingRow[]));
  }
  return rows;
}

async function loadMembershipHits(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string[]>> {
  const hits = new Map<string, string[]>();
  for (const part of chunks(ids, 100)) {
    const { data, error } = await withPostgrestTransientRetry("discovery.membership-hits", async () =>
      supabase
        .from("ipon_category_membership")
        .select("supplier_product_id, supplier_category_id")
        .in("supplier_product_id", part)
    );
    if (error) throw new Error(`membership hits: ${error.message}`);
    for (const row of (data ?? []) as Array<{ supplier_product_id: string; supplier_category_id: string }>) {
      const list = hits.get(String(row.supplier_product_id)) ?? [];
      list.push(String(row.supplier_category_id));
      hits.set(String(row.supplier_product_id), list);
    }
  }
  return hits;
}

function toImportItem(feed: IponFeedProduct, tracking: IponTrackingProduct): { item: IponProductItem } | { reason: string } {
  const grossPrice = tracking.grossPrice ?? feed.price;
  if (grossPrice == null) return { reason: "no_price" };
  const englishUrl = toIponEnglishProductUrl(feed.productUrl);
  if (!englishUrl) return { reason: "bad_url" };
  const item: IponProductItem = {
    id: feed.identifier,
    displayName: tracking.displayName,
    brand: tracking.brand ?? feed.manufacturer,
    grossPrice,
    deliveryDays: tracking.plusDays,
    pictures: feed.imageUrl ? [feed.imageUrl] : [],
    ean: feed.ean,
    mpn: feed.productNumber,
    url: englishUrl,
    englishProductUrl: englishUrl,
    productGroup: tracking.productGroup,
    searchProductGroup: tracking.searchProductGroup,
    breadcrumb: tracking.breadcrumb
  };
  return { item };
}

async function deferPending(
  supabase: SupabaseClient,
  row: PendingRow,
  status: string,
  reason: string,
  candidateCategoryIds: string[],
  snapshot: FeedSnapshot | null,
  productGroup?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("ipon_feed_pending")
    .update({
      status,
      reason,
      attempts: row.attempts + 1,
      last_attempt_at: new Date().toISOString(),
      candidate_category_ids: candidateCategoryIds,
      unclassified_checks: row.unclassified_checks,
      ...(snapshot ? { feed_snapshot: snapshot } : {}),
      ...(productGroup !== undefined ? { product_group: productGroup } : {})
    })
    .eq("supplier_product_id", row.supplier_product_id);
  if (error) console.warn(`[iPon discovery] pending ${row.supplier_product_id}:`, error.message);
}

async function trackIds(
  ids: string[],
  jar: Map<string, string>,
  session: MutableSession
): Promise<IponTrackingProduct[]> {
  const first = await fetchIponTrackingBatch(ids, jar, session.current);
  session.current = first.session;
  const found = new Set(first.products.map((product) => product.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length === 0) return first.products;
  await pauseBetweenIponCalls();
  const second = await fetchIponTrackingBatch(missing, jar, session.current);
  session.current = second.session;
  return first.products.concat(second.products);
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      await fn(items[current]!);
    }
  });
  await Promise.all(workers);
}

function emptyResult(
  partial: Partial<IponImportProductsResult> & { success: boolean }
): IponImportProductsResult {
  return {
    imported: 0,
    succeeded: 0,
    updated: 0,
    activated: 0,
    deactivated: 0,
    pricesAggregated: 0,
    categoriesProcessed: 0,
    ...partial
  };
}

export async function runIponFeedDiscovery(
  options?: RunIponFeedDiscoveryOptions
): Promise<IponImportProductsResult> {
  const dryRun = options?.dryRun ?? process.env.IPON_IMPORT_DRY_RUN?.trim() === "1";
  const learnOnly = !dryRun && process.env.IPON_LEARN_ONLY?.trim() === "1";
  const budget = options?.budget ?? 0;
  const unlimited = !dryRun && budget <= 0;
  const sampleLimit = dryRun
    ? budget > 0
      ? Math.min(budget, numEnv("IPON_IMPORT_DRY_RUN_SAMPLE", 20))
      : numEnv("IPON_IMPORT_DRY_RUN_SAMPLE", 20)
    : budget;
  const feedUrl = process.env.IPON_PRODUCT_FEED_URL?.trim() || DEFAULT_IPON_PRODUCT_FEED_URL;
  const minItems = numEnv("IPON_PRODUCT_FEED_MIN_ITEMS", DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS);

  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();
  const session: MutableSession = { current: null };

  let rows = await loadIponMappedCategories(supabase);
  const learned = dryRun
    ? { learned: 0, skippedEmpty: 0, requests: 0, captcha: false }
    : await learnProductGroups(supabase, rows, jar, session);
  if (!dryRun) rows = await loadIponMappedCategories(supabase);

  if (learnOnly) {
    console.log("[iPon discovery] Učenje naziva završeno.", learned);
    return emptyResult({
      success: !learned.captcha,
      categoriesProcessed: rows.length,
      summary: {
        imported: 0,
        succeeded: 0,
        updated: 0,
        activated: 0,
        deactivated_offers: 0,
        prices_aggregated: 0,
        aggregate_batches: 0,
        categories_processed: rows.length,
        import_mode: "feed-discovery",
        groups_learned: learned.learned,
        groups_skipped_empty: learned.skippedEmpty,
        tracking_captcha: learned.captcha,
        learn_only: true,
        dry_run: false
      }
    });
  }

  console.log(`[iPon discovery] Učitavam postojeće iPon ID-eve…`);
  const knownIds = await loadSupplierProductIds(supabase);
  console.log(`[iPon discovery] U bazi: ${knownIds.size}. Feed: ${feedUrl}`);

  const missing = new Map<string, IponFeedProduct>();
  const streamed = await streamIponProductFeed(feedUrl, {
    minItems,
    onProgress: (count) => console.log(`[iPon discovery] Feed parsiran: ${count}`),
    onProduct: (product) => {
      if (!knownIds.has(product.identifier)) missing.set(product.identifier, product);
    }
  });

  console.log(`[iPon discovery] Feed ${streamed.count}, nedostaje u bazi ${missing.size}, dryRun=${dryRun}`);
  if (!dryRun) await syncPendingTable(supabase, missing);

  const mappedGroups = new Set<string>();
  for (const row of rows) {
    if (!row.productGroupLearnedAt) continue;
    for (const name of row.productGroups) mappedGroups.add(name);
  }

  const deferredByReason: Record<string, number> = {};
  const bump = (reason: string) => {
    deferredByReason[reason] = (deferredByReason[reason] ?? 0) + 1;
  };
  const unknownReport = new Map<string, UnknownGroupReport>();

  let inserted = 0;
  let linked = 0;
  let insertErrors = 0;
  let trackingCaptcha = false;
  let listCaptcha = false;
  let processed = 0;
  const newProductIds: string[] = [];
  const readyLists = new Set<string>();
  const blockedLists = new Set<string>();
  const handledIds = new Set<string>();

  const dryQueue: PendingRow[] = dryRun
    ? Array.from(missing.values())
        .slice(0, sampleLimit)
        .map((product) => ({
          supplier_product_id: product.identifier,
          first_seen_at: new Date().toISOString(),
          attempts: 0,
          unclassified_checks: 0,
          last_membership_proof_at: null,
          product_group: null,
          reason: null,
          feed_snapshot: snapshotOf(product)
        }))
    : [];

  async function ensureLists(owners: IponMappedCategory[]): Promise<void> {
    for (const owner of owners) {
      if (owner.listReady || readyLists.has(owner.id) || blockedLists.has(owner.id) || listCaptcha) continue;
      if (!owner.listingUrl) {
        blockedLists.add(owner.id);
        continue;
      }
      console.log(`[iPon discovery] Lista ${owner.groupKey ?? owner.id} (${owner.filtered ? "filter" : "obična"})`);
      const result = await syncFilteredCategoryMembership(supabase, owner, jar, session, {
        remaining: 1_000_000
      });
      if (result.status === "complete") {
        owner.listReady = true;
        readyLists.add(owner.id);
      } else {
        blockedLists.add(owner.id);
      }
      if (result.captcha) {
        listCaptcha = true;
        console.warn("[iPon discovery] Lista prekinuta. Artikli te grupe čekaju sljedeću noć.");
      }
    }
  }

  async function processBatch(batch: PendingRow[]): Promise<void> {
    if (batch.length === 0 || trackingCaptcha || listCaptcha) return;
    if (processed > 0) await pauseBetweenIponCalls();

    let tracked: IponTrackingProduct[] = [];
    try {
      tracked = await trackIds(
        batch.map((row) => row.supplier_product_id),
        jar,
        session
      );
    } catch (error) {
      if (error instanceof IponCaptchaError) {
        trackingCaptcha = true;
        console.warn("[iPon discovery] Tracking captcha — prekid, red ostaje.");
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[iPon discovery] Tracking batch: ${message}`);
      for (const row of batch) {
        bump("tracking_error");
        if (!dryRun) {
          const feed = missing.get(row.supplier_product_id) ?? feedFromSnapshot(row.supplier_product_id, row.feed_snapshot);
          await deferPending(supabase, row, "pending", "tracking_error", [], feed ? snapshotOf(feed) : null);
        }
      }
      return;
    }

    const byId = new Map(tracked.map((product) => [product.id, product]));
    const needsLink: Array<{ row: PendingRow; tracking: IponTrackingProduct; feed: IponFeedProduct }> = [];

    for (const row of batch) {
      const feed = missing.get(row.supplier_product_id) ?? feedFromSnapshot(row.supplier_product_id, row.feed_snapshot);
      const tracking = byId.get(row.supplier_product_id);
      if (!tracking) {
        bump("no_tracking");
        if (!dryRun) await deferPending(supabase, row, "no_tracking", "no_tracking", [], feed ? snapshotOf(feed) : null);
        continue;
      }
      if (!feed) {
        bump("missing_feed_row");
        if (!dryRun) await deferPending(supabase, row, "pending", "missing_feed_row", [], null);
        continue;
      }
      const owners = ownersForProductGroup(rows, tracking.productGroup);
      if (owners.length === 0 || !needsListCheck(owners)) continue;
      needsLink.push({ row, tracking, feed });
    }

    const ownersToRead = new Map<string, IponMappedCategory>();
    for (const item of needsLink) {
      for (const owner of ownersForProductGroup(rows, item.tracking.productGroup)) {
        ownersToRead.set(owner.id, owner);
      }
    }
    if (!dryRun && ownersToRead.size > 0) await ensureLists(Array.from(ownersToRead.values()));

    const hits = dryRun
      ? new Map<string, string[]>()
      : await loadMembershipHits(
          supabase,
          needsLink.map((item) => item.row.supplier_product_id)
        );

    const assignments: Array<{ row: PendingRow; item: IponProductItem; internalCategoryId: string }> = [];

    for (const row of batch) {
      const feed = missing.get(row.supplier_product_id) ?? feedFromSnapshot(row.supplier_product_id, row.feed_snapshot);
      const tracking = byId.get(row.supplier_product_id);
      if (!tracking || !feed) continue;
      const built = toImportItem(feed, tracking);
      if ("reason" in built) {
        bump(built.reason);
        if (!dryRun) await deferPending(supabase, row, "pending", built.reason, [], snapshotOf(feed));
        continue;
      }

      const decision = classifyFeedProduct({
        productGroup: tracking.productGroup,
        membershipCategoryIds: hits.get(row.supplier_product_id) ?? [],
        rows
      });

      if (decision.kind === "defer") {
        bump(decision.reason);
        if (decision.reason === "unknown_group") {
          noteUnknown(unknownReport, tracking.productGroup, tracking.displayName);
        }
        if (dryRun) {
          console.log(
            `[iPon discovery][dry-run] ${row.supplier_product_id} ${tracking.displayName} → ${decision.reason}`
          );
        } else {
          await deferPending(
            supabase,
            row,
            decision.status,
            decision.reason,
            decision.candidateCategoryIds,
            snapshotOf(feed),
            decision.reason === "unknown_group" ? tracking.productGroup : undefined
          );
        }
        continue;
      }

      if (dryRun) {
        inserted += 1;
        console.log(
          `[iPon discovery][dry-run] INSERT ${row.supplier_product_id} "${tracking.displayName}" → ${decision.internalCategoryId}`
        );
        continue;
      }
      assignments.push({ row, item: built.item, internalCategoryId: decision.internalCategoryId });
    }

    await runPool(assignments, numEnv("IPON_IMPORT_CONCURRENCY", 3), async (task) => {
      try {
        const result = await insertOrLinkIponListItem(supabase, task.item, task.internalCategoryId);
        const { error } = await supabase.from("ipon_feed_pending").delete().eq("supplier_product_id", task.row.supplier_product_id);
        if (error) console.warn(`[iPon discovery] pending delete ${task.row.supplier_product_id}:`, error.message);
        if (result.outcome === "imported") {
          inserted += 1;
          if (result.productId) newProductIds.push(result.productId);
        } else {
          linked += 1;
          if (result.productId) newProductIds.push(result.productId);
        }
      } catch (error) {
        insertErrors += 1;
        bump("insert_error");
        console.warn(
          `[iPon discovery] insert ${task.row.supplier_product_id}:`,
          error instanceof Error ? error.message : String(error)
        );
        await deferPending(supabase, task.row, "pending", "insert_error", [], null);
      }
    });
  }

  if (!dryRun && learned.requests > 0) await pauseBetweenIponCalls();

  if (dryRun) {
    await processBatch(dryQueue);
    processed = dryQueue.length;
  } else {
    while (!trackingCaptcha && !listCaptcha && (unlimited || processed < budget)) {
      const room = unlimited ? IPON_TRACKING_BATCH_SIZE : Math.min(IPON_TRACKING_BATCH_SIZE, budget - processed);
      if (room <= 0) break;
      const active = await loadActivePending(supabase, room);
      const loaded = active.length > 0 ? active : await loadPromotedPending(supabase, Array.from(mappedGroups), room);
      const batch = loaded.filter((row) => !handledIds.has(row.supplier_product_id));
      if (batch.length === 0) break;
      for (const row of batch) handledIds.add(row.supplier_product_id);
      await processBatch(batch);
      processed += batch.length;
    }
  }

  let pricesAggregated = 0;
  let aggregateBatches = 0;
  let aggError: string | undefined;
  let aggWarnings: string[] | undefined;
  if (!dryRun && newProductIds.length > 0) {
    const agg = await aggregateDiscoveryNewProductPrices(true, newProductIds);
    pricesAggregated = agg.pricesAggregated;
    aggregateBatches = agg.aggregateBatches;
    aggError = agg.aggError;
    aggWarnings = agg.aggWarnings;
  }

  let imagesTried = 0;
  let imagesHosted = 0;
  if (!dryRun) {
    try {
      const images = await retryIponPicturesMissingHosted(supabase);
      imagesTried = images.tried;
      imagesHosted = images.hosted;
      console.log(`[iPon discovery] Slike: pokušano ${imagesTried}, sačuvano ${imagesHosted}`);
    } catch (error) {
      console.warn("[iPon discovery] Ponovni pokušaj slika:", error instanceof Error ? error.message : String(error));
    }
  }

  const unknownGroups = Array.from(unknownReport.entries()).map(([productGroup, entry]) => ({
    product_group: productGroup,
    count: entry.count,
    names: entry.names
  }));
  for (const group of unknownGroups) {
    console.log(
      `[iPon discovery] Nepoznat productGroup "${group.product_group}" (${group.count}): ${group.names.join(" | ")}`
    );
  }

  const success = !trackingCaptcha && !listCaptcha && !learned.captcha && insertErrors === 0 && !aggError;
  console.log("[iPon discovery] Završeno.", {
    feed: streamed.count,
    missing: missing.size,
    inserted,
    linked,
    processed,
    trackingCaptcha,
    listCaptcha,
    insertErrors
  });

  return {
    success,
    imported: inserted,
    succeeded: linked,
    updated: 0,
    activated: 0,
    deactivated: 0,
    pricesAggregated,
    categoriesProcessed: rows.length,
    summary: {
      imported: inserted,
      succeeded: linked,
      updated: 0,
      activated: 0,
      deactivated_offers: 0,
      prices_aggregated: pricesAggregated,
      aggregate_batches: aggregateBatches,
      categories_processed: rows.length,
      import_mode: "feed-discovery",
      feed_items: streamed.count,
      missing: missing.size,
      inserted,
      linked,
      deferred_by_reason: deferredByReason,
      groups_learned: learned.learned,
      groups_skipped_empty: learned.skippedEmpty,
      tracking_captcha: trackingCaptcha || learned.captcha,
      list_captcha: listCaptcha,
      dry_run: dryRun,
      images_retried: imagesTried,
      images_hosted: imagesHosted,
      unknown_groups: unknownGroups,
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
    }
  };
}
