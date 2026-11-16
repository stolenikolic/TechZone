/**
 * Nightly iPon discovery: Hungarian feed, two-level menu list, tracking for decided articles.
 * Does not crawl /shop/group/.../product/data. Does not update existing offers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { classifyFeedProduct, type ClassifyFeedResult, type IponMappedCategory } from "./classifyFeedProduct";
import { IPON_SUPPLIER_ID } from "./constants";
import {
  aggregateDiscoveryNewProductPrices,
  insertOrLinkIponListItem,
  type IponImportProductsResult
} from "./importProducts";
import { retryIponPicturesMissingHosted } from "./ipon-product-images";
import { IponCaptchaError, numEnv } from "./ipon-fetch";
import { listIdForCategoryPath, loadIponHungarianMenu, type IponMenuIndex } from "./iponMenu";
import { loadIponMappedCategories, syncFilteredCategoryMembership } from "./listMembership";
import {
  DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS,
  DEFAULT_IPON_PRODUCT_FEED_URL,
  streamIponProductFeed,
  toIponEnglishProductUrl,
  twoLevelFeedKey,
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
const SAMPLE_CATEGORY_SLOTS = 8;

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

type PendingState = {
  reason: string | null;
  product_group: string | null;
  attempts: number;
};

type MutableSession = { current: IponXhrSession | null };

type UnknownPathReport = { count: number; names: string[] };

type DirectItem = { product: IponFeedProduct; categoryId: string };

type SkippedItem = { id: string; path: string; reason: string; status: string };

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

function noteUnknown(report: Map<string, UnknownPathReport>, path: string | null, articleName: string | null): void {
  const key = path?.trim() || "(bez putanje)";
  const entry = report.get(key) ?? { count: 0, names: [] };
  entry.count += 1;
  const name = articleName?.trim() ?? "";
  if (name && entry.names.length < UNKNOWN_NAME_LIMIT && !entry.names.includes(name)) entry.names.push(name);
  report.set(key, entry);
}

function pendingShell(product: IponFeedProduct, state: PendingState | undefined): PendingRow {
  return {
    supplier_product_id: product.identifier,
    first_seen_at: new Date().toISOString(),
    attempts: state?.attempts ?? 0,
    unclassified_checks: 0,
    last_membership_proof_at: null,
    product_group: state?.product_group ?? null,
    reason: state?.reason ?? null,
    feed_snapshot: snapshotOf(product)
  };
}

function takeSpread(items: DirectItem[], limit: number): IponFeedProduct[] {
  if (!Number.isFinite(limit)) return items.map((item) => item.product);
  const chosen: IponFeedProduct[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const perCategory = Math.max(1, Math.ceil(limit / SAMPLE_CATEGORY_SLOTS));
  for (const item of items) {
    if (chosen.length >= limit) break;
    const count = counts.get(item.categoryId) ?? 0;
    if (count >= perCategory) continue;
    counts.set(item.categoryId, count + 1);
    seen.add(item.product.identifier);
    chosen.push(item.product);
  }
  if (chosen.length < limit) {
    for (const item of items) {
      if (chosen.length >= limit) break;
      if (seen.has(item.product.identifier)) continue;
      seen.add(item.product.identifier);
      chosen.push(item.product);
    }
  }
  return chosen;
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

async function loadPendingState(supabase: SupabaseClient): Promise<Map<string, PendingState>> {
  const states = new Map<string, PendingState>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("discovery.pending-ids", async () =>
      supabase
        .from("ipon_feed_pending")
        .select("supplier_product_id, reason, product_group, attempts")
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`ipon_feed_pending ids: ${error.message}`);
    const page = (data ?? []) as Array<{
      supplier_product_id: string;
      reason: string | null;
      product_group: string | null;
      attempts: number | null;
    }>;
    for (const row of page) {
      states.set(String(row.supplier_product_id), {
        reason: row.reason,
        product_group: row.product_group,
        attempts: row.attempts ?? 0
      });
    }
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }
  return states;
}

async function syncPendingTable(
  supabase: SupabaseClient,
  missing: Map<string, IponFeedProduct>,
  pending: Map<string, PendingState>
): Promise<void> {
  const stale: string[] = [];
  pending.forEach((_state, id) => {
    if (!missing.has(id)) stale.push(id);
  });
  for (const part of chunks(stale, DB_CHUNK)) {
    const { error } = await supabase.from("ipon_feed_pending").delete().in("supplier_product_id", part);
    if (error) throw new Error(`ipon_feed_pending delete: ${error.message}`);
  }
  for (const id of stale) pending.delete(id);

  const fresh: IponFeedProduct[] = [];
  missing.forEach((product, id) => {
    if (!pending.has(id)) fresh.push(product);
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
    for (const product of part) {
      pending.set(product.identifier, { reason: null, product_group: null, attempts: 0 });
    }
    inserted += part.length;
    if (inserted % 2000 === 0 || inserted === fresh.length) {
      console.log(`[iPon discovery] Pending novi redovi: ${inserted}/${fresh.length}`);
    }
  }
  if (stale.length > 0) console.log(`[iPon discovery] Pending obrisano (više nisu novi): ${stale.length}`);
}

async function markSkipped(
  supabase: SupabaseClient,
  skipped: SkippedItem[],
  pending: Map<string, PendingState>
): Promise<void> {
  const groups = new Map<string, SkippedItem[]>();
  for (const item of skipped) {
    const state = pending.get(item.id);
    if (state && state.reason === item.reason && state.product_group === item.path) continue;
    const key = `${item.status}\n${item.reason}\n${item.path}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const now = new Date().toISOString();
  for (const list of Array.from(groups.values())) {
    const sample = list[0];
    if (!sample) continue;
    for (const part of chunks(list, DB_CHUNK)) {
      const { error } = await supabase
        .from("ipon_feed_pending")
        .update({
          status: sample.status,
          reason: sample.reason,
          product_group: sample.path,
          last_attempt_at: now
        })
        .in(
          "supplier_product_id",
          part.map((item) => item.id)
        );
      if (error) throw new Error(`ipon_feed_pending putanja: ${error.message}`);
      for (const item of part) {
        const state = pending.get(item.id) ?? { reason: null, product_group: null, attempts: 0 };
        state.reason = item.reason;
        state.product_group = item.path;
        pending.set(item.id, state);
      }
    }
  }
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
  const grossPrice = feed.price ?? tracking.grossPrice;
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

function emptyResult(partial: Partial<IponImportProductsResult> & { success: boolean }): IponImportProductsResult {
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

function summaryBase(categories: number, extra: NonNullable<IponImportProductsResult["summary"]> extends infer T ? Partial<T> : never) {
  return {
    imported: 0,
    succeeded: 0,
    updated: 0,
    activated: 0,
    deactivated_offers: 0,
    prices_aggregated: 0,
    aggregate_batches: 0,
    categories_processed: categories,
    import_mode: "feed-discovery" as string,
    ...extra
  };
}

const MENU_PROBE_KEYS = [
  "Számítógép alkatrész > Tápegység",
  "Hálózat, szerver, biztonságtechnika > Switch",
  "Hálózat, szerver, biztonságtechnika > Router",
  "Hálózat, szerver, biztonságtechnika > Szerver további alkatrész",
  "Otthon, kert, barkács > Szerelési anyagok"
];

function logMenuProbes(menu: IponMenuIndex, rows: IponMappedCategory[]): void {
  for (const key of MENU_PROBE_KEYS) {
    const listId = menu.listIdByTwoLevelKey.get(key) ?? null;
    const names = rows.filter((row) => row.groupKey === listId).map((row) => row.categoryName ?? row.id);
    console.log(`[iPon menu] ${key} → ${listId ?? "nema"} → ${names.join(", ") || "nema kategorije"}`);
  }
}

export async function runIponFeedDiscovery(options?: RunIponFeedDiscoveryOptions): Promise<IponImportProductsResult> {
  const dryRun = options?.dryRun ?? process.env.IPON_IMPORT_DRY_RUN?.trim() === "1";
  const learnOnly = process.env.IPON_LEARN_ONLY?.trim() === "1";
  const budget = options?.budget ?? numEnv("IPON_DISCOVERY_BUDGET", 0);
  const unlimited = !dryRun && budget <= 0;
  const sampleLimit = dryRun
    ? budget > 0
      ? Math.min(budget, numEnv("IPON_IMPORT_DRY_RUN_SAMPLE", 20))
      : numEnv("IPON_IMPORT_DRY_RUN_SAMPLE", 20)
    : budget;

  if (learnOnly) {
    console.log("[iPon discovery] Učenje productGroup je isključeno. Nema uvoza.");
    return emptyResult({
      success: true,
      summary: summaryBase(0, { learn_only: true, dry_run: false, groups_learned: 0 })
    });
  }

  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();
  const session: MutableSession = { current: null };
  const rows = await loadIponMappedCategories(supabase);

  let menu: IponMenuIndex;
  try {
    menu = await loadIponHungarianMenu(jar);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[iPon discovery] Meni nije učitan. Ove noći nema uvoza.", message);
    return emptyResult({
      success: false,
      categoriesProcessed: rows.length,
      summary: summaryBase(rows.length, { menu_error: message, dry_run: dryRun })
    });
  }
  logMenuProbes(menu, rows);

  const feedUrl = process.env.IPON_PRODUCT_FEED_URL?.trim() || DEFAULT_IPON_PRODUCT_FEED_URL;
  const minItems = numEnv("IPON_PRODUCT_FEED_MIN_ITEMS", DEFAULT_IPON_PRODUCT_FEED_MIN_ITEMS);

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
  const pending = dryRun ? new Map<string, PendingState>() : await loadPendingState(supabase);
  if (!dryRun) await syncPendingTable(supabase, missing, pending);

  const deferredByReason: Record<string, number> = {};
  const bump = (reason: string) => {
    deferredByReason[reason] = (deferredByReason[reason] ?? 0) + 1;
  };
  const unknownReport = new Map<string, UnknownPathReport>();
  const direct: DirectItem[] = [];
  const needsList: IponFeedProduct[] = [];
  const skipped: SkippedItem[] = [];

  const decide = (product: IponFeedProduct, membershipCategoryIds: string[]): ClassifyFeedResult =>
    classifyFeedProduct({
      categoryPath: product.categoryPath,
      menuListId: listIdForCategoryPath(menu, product.categoryPath),
      membershipCategoryIds,
      rows
    });

  for (const product of Array.from(missing.values())) {
    const decision = decide(product, []);
    if (decision.kind === "assign") {
      direct.push({ product, categoryId: decision.internalCategoryId });
      continue;
    }
    if (decision.reason === "awaiting_list") {
      needsList.push(product);
      continue;
    }
    bump(decision.reason);
    if (decision.reason === "unknown_path" || decision.reason === "ambiguous_path") {
      noteUnknown(unknownReport, decision.path ?? null, product.name);
    }
    skipped.push({
      id: product.identifier,
      path: decision.path ?? twoLevelFeedKey(product.categoryPath) ?? "(bez putanje)",
      reason: decision.reason,
      status: decision.status
    });
  }

  console.log(
    `[iPon discovery] Direktno ${direct.length}, dijeljene liste ${needsList.length}, preskočeno ${skipped.length}`
  );

  let inserted = 0;
  let linked = 0;
  let insertErrors = 0;
  let trackingCaptcha = false;
  let listCaptcha = false;
  let processed = 0;
  const newProductIds: string[] = [];
  const readyLists = new Set<string>();
  const blockedLists = new Set<string>();

  const categoryLabel = (supplierCategoryId: string, internalCategoryId: string) => {
    const row =
      rows.find((item) => item.id === supplierCategoryId) ??
      rows.find((item) => item.internalCategoryId === internalCategoryId);
    return row?.categoryName ?? internalCategoryId;
  };

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

  async function importProducts(products: IponFeedProduct[], hits: Map<string, string[]>): Promise<void> {
    for (const batch of chunks(products, IPON_TRACKING_BATCH_SIZE)) {
      if (batch.length === 0 || trackingCaptcha || listCaptcha) return;
      if (processed > 0) await pauseBetweenIponCalls();

      let tracked: IponTrackingProduct[] = [];
      try {
        tracked = await trackIds(
          batch.map((product) => product.identifier),
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
        for (const product of batch) {
          bump("tracking_error");
          if (!dryRun) {
            await deferPending(supabase, pendingShell(product, pending.get(product.identifier)), "pending", "tracking_error", [], snapshotOf(product));
          }
        }
        processed += batch.length;
        continue;
      }

      const byId = new Map(tracked.map((product) => [product.id, product]));
      const assignments: Array<{ product: IponFeedProduct; item: IponProductItem; internalCategoryId: string }> = [];

      for (const product of batch) {
        const tracking = byId.get(product.identifier);
        const shell = pendingShell(product, pending.get(product.identifier));
        if (!tracking) {
          bump("no_tracking");
          if (dryRun) console.log(`[iPon discovery][dry-run] ${product.identifier} ${product.name ?? ""} → no_tracking`);
          else await deferPending(supabase, shell, "no_tracking", "no_tracking", [], snapshotOf(product));
          continue;
        }

        const decision = decide(product, hits.get(product.identifier) ?? []);
        if (decision.kind === "defer") {
          bump(decision.reason);
          if (decision.reason === "unknown_path" || decision.reason === "ambiguous_path") {
            noteUnknown(unknownReport, decision.path ?? null, tracking.displayName);
          }
          if (dryRun) {
            console.log(
              `[iPon discovery][dry-run] ${product.identifier} ${tracking.displayName} → ${decision.reason} ${decision.path ?? ""}`
            );
          } else {
            await deferPending(
              supabase,
              shell,
              decision.status,
              decision.reason,
              decision.candidateCategoryIds,
              snapshotOf(product),
              decision.path
            );
          }
          continue;
        }

        const built = toImportItem(product, tracking);
        if ("reason" in built) {
          bump(built.reason);
          if (dryRun) {
            console.log(`[iPon discovery][dry-run] ${product.identifier} ${tracking.displayName} → ${built.reason}`);
          } else {
            await deferPending(supabase, shell, "pending", built.reason, [], snapshotOf(product));
          }
          continue;
        }

        const label = categoryLabel(decision.supplierCategoryId, decision.internalCategoryId);
        if (dryRun) {
          inserted += 1;
          console.log(
            `[iPon discovery][dry-run] INSERT ${product.identifier} "${tracking.displayName}" path "${product.categoryPath ?? ""}" → ${label}`
          );
          continue;
        }
        assignments.push({ product, item: built.item, internalCategoryId: decision.internalCategoryId });
      }

      await runPool(assignments, numEnv("IPON_IMPORT_CONCURRENCY", 3), async (task) => {
        try {
          const result = await insertOrLinkIponListItem(supabase, task.item, task.internalCategoryId);
          const { error } = await supabase.from("ipon_feed_pending").delete().eq("supplier_product_id", task.product.identifier);
          if (error) console.warn(`[iPon discovery] pending delete ${task.product.identifier}:`, error.message);
          pending.delete(task.product.identifier);
          if (result.outcome === "imported") {
            inserted += 1;
            if (result.productId) newProductIds.push(result.productId);
            console.log(
              `[iPon discovery] INSERT ${task.product.identifier} "${task.item.displayName}" → ${categoryLabel("", task.internalCategoryId)}`
            );
          } else {
            linked += 1;
            if (result.productId) newProductIds.push(result.productId);
          }
        } catch (error) {
          insertErrors += 1;
          bump("insert_error");
          console.warn(
            `[iPon discovery] insert ${task.product.identifier}:`,
            error instanceof Error ? error.message : String(error)
          );
          await deferPending(supabase, pendingShell(task.product, pending.get(task.product.identifier)), "pending", "insert_error", [], null);
        }
      });
      processed += batch.length;
    }
  }

  const cap = unlimited ? Number.POSITIVE_INFINITY : sampleLimit;
  const chosen = takeSpread(direct, cap);
  await importProducts(chosen, new Map());

  const room = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, cap - chosen.length);
  if (room > 0 && !trackingCaptcha && !listCaptcha && needsList.length > 0) {
    const listProducts = Number.isFinite(room) ? needsList.slice(0, room) : needsList;
    const ownerIds = new Set<string>();
    for (const product of listProducts) {
      const decision = decide(product, []);
      if (decision.kind === "defer") {
        for (const id of decision.candidateCategoryIds) ownerIds.add(id);
      }
    }
    const owners = rows.filter((row) => ownerIds.has(row.id));
    if (!dryRun && owners.length > 0) await ensureLists(owners);
    const hits = dryRun
      ? new Map<string, string[]>()
      : await loadMembershipHits(
          supabase,
          listProducts.map((product) => product.identifier)
        );
    const ready: IponFeedProduct[] = [];
    for (const product of listProducts) {
      const decision = decide(product, hits.get(product.identifier) ?? []);
      if (decision.kind === "assign") ready.push(product);
      else if (!dryRun) {
        bump(decision.reason);
        await deferPending(
          supabase,
          pendingShell(product, pending.get(product.identifier)),
          decision.status,
          decision.reason,
          decision.candidateCategoryIds,
          snapshotOf(product),
          decision.path
        );
      } else {
        bump(decision.reason);
        console.log(
          `[iPon discovery][dry-run] ${product.identifier} ${product.name ?? ""} → ${decision.reason} ${decision.path ?? ""}`
        );
      }
    }
    await importProducts(ready, hits);
  }

  if (!dryRun && unlimited && skipped.length > 0 && !trackingCaptcha) {
    try {
      await markSkipped(supabase, skipped, pending);
      console.log(`[iPon discovery] Upisane nepoznate putanje: ${skipped.length}`);
    } catch (error) {
      console.warn("[iPon discovery] Upis putanja:", error instanceof Error ? error.message : String(error));
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

  const unknownPaths = Array.from(unknownReport.entries()).map(([path, entry]) => ({
    path,
    count: entry.count,
    names: entry.names
  }));
  const loggedPaths = unknownPaths.slice().sort((a, b) => b.count - a.count).slice(0, 30);
  for (const group of loggedPaths) {
    console.log(`[iPon discovery] Nepoznata putanja "${group.path}" (${group.count}): ${group.names.join(" | ")}`);
  }
  if (unknownPaths.length > loggedPaths.length) {
    console.log(`[iPon discovery] Još nepoznatih putanja: ${unknownPaths.length - loggedPaths.length}`);
  }

  const success = !trackingCaptcha && !listCaptcha && insertErrors === 0 && !aggError;
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
      groups_learned: 0,
      tracking_captcha: trackingCaptcha,
      list_captcha: listCaptcha,
      dry_run: dryRun,
      images_retried: imagesTried,
      images_hosted: imagesHosted,
      unknown_paths: unknownPaths,
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
    }
  };
}
