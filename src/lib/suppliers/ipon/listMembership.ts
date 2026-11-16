/**
 * Filtered iPon categories: page the list API and store id → supplier_categories.
 * A sync is complete only when the fetched id count matches `total` (or the last
 * page is short and there is no total). Incomplete runs never delete old rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWithSession } from "lib/suppliers/shared/http-session";
import { IPON_SUPPLIER_ID } from "./constants";
import type { IponMappedCategory, IponMembershipStatus } from "./classifyFeedProduct";
import {
  IPON_ACCEPT_LANGUAGE,
  IPON_IMPORT_USER_AGENT,
  IponCaptchaError,
  listingUrlHasFilterParams,
  looksLikeCaptchaOrBlock,
  numEnv,
  parseGroupIdFromListingUrl
} from "./ipon-fetch";
import { manualFeedPathFromInput } from "./productFeed";
import { withPostgrestTransientRetry, withTransientHttpRetry } from "./transient-retry";
import { pauseBetweenIponCalls } from "./trackingApi";
import { ensureIponXhrSession, IponXhrTokenError, iponXhrHeaders, type IponXhrSession } from "./xhrToken";

const IPON_ORIGIN = "https://iponcomp.com";
const LIST_PAGE_SIZE = 36;
const DB_CHUNK = 200;

export type IponListPage = {
  ids: string[];
  total: number | null;
  pageSize: number | null;
};

export function parseIponListProductsPage(body: unknown): IponListPage {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const items = Array.isArray(body) ? body : Array.isArray(rec?.items) ? rec.items : [];
  const ids: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const id = (raw as Record<string, unknown>).id;
    if (typeof id === "number" && Number.isFinite(id)) ids.push(String(Math.trunc(id)));
    else if (typeof id === "string" && /^\d+$/.test(id.trim())) ids.push(id.trim());
  }
  const totalRaw = rec?.total ?? rec?.totalCount;
  const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw >= 0 ? Math.trunc(totalRaw) : null;
  const pageSizeRaw = rec?.pageSize;
  const pageSize =
    typeof pageSizeRaw === "number" && Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.trunc(pageSizeRaw) : null;
  return { ids, total, pageSize };
}

export function buildIponListProductsUrl(
  listingUrl: string,
  page: number,
  filtered: boolean,
  groupIdOverride?: number
): string {
  const groupId =
    groupIdOverride != null && Number.isFinite(groupIdOverride)
      ? groupIdOverride
      : parseGroupIdFromListingUrl(listingUrl);
  const url = new URL(`${IPON_ORIGIN}/api/shop/lists/${groupId}/products`);
  if (filtered) {
    const listing = new URL(listingUrl);
    listing.searchParams.forEach((value, key) => {
      const name = key.toLowerCase();
      if (name === "page" || name === "pagesize" || name === "limit") return;
      url.searchParams.append(key, value);
    });
  }
  if (!url.searchParams.has("sortOrder")) url.searchParams.set("sortOrder", "relevancia");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(LIST_PAGE_SIZE));
  return url.toString();
}

type MutableSession = { current: IponXhrSession | null };

async function fetchListPage(
  url: string,
  referer: string,
  jar: Map<string, string>,
  session: MutableSession
): Promise<IponListPage> {
  const once = async (active: IponXhrSession) => {
    const res = await withTransientHttpRetry(
      "list products",
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
    try {
      return parseIponListProductsPage(JSON.parse(text) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("iPon list: odgovor nije JSON");
      throw error;
    }
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

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function replaceMembership(
  supabase: SupabaseClient,
  supplierCategoryId: string,
  ids: string[]
): Promise<void> {
  const existing = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("membership.existing", async () =>
      supabase
        .from("ipon_category_membership")
        .select("supplier_product_id")
        .eq("supplier_category_id", supplierCategoryId)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + 999)
    );
    if (error) throw new Error(`membership read: ${error.message}`);
    const page = (data ?? []) as Array<{ supplier_product_id: string }>;
    for (const row of page) existing.add(String(row.supplier_product_id));
    if (page.length < 1000) break;
    offset += page.length;
  }

  const now = new Date().toISOString();
  const fresh = new Set(ids);
  const toInsert = ids.filter((id) => !existing.has(id));
  const toTouch = ids.filter((id) => existing.has(id));
  const toDelete = Array.from(existing).filter((id) => !fresh.has(id));

  for (const part of chunks(toInsert, DB_CHUNK)) {
    const rows = part.map((id) => ({
      supplier_product_id: id,
      supplier_category_id: supplierCategoryId,
      first_seen_at: now,
      last_seen_at: now
    }));
    const { error } = await withPostgrestTransientRetry("membership.insert", async () =>
      supabase.from("ipon_category_membership").insert(rows)
    );
    if (error) throw new Error(`membership insert: ${error.message}`);
  }

  for (const part of chunks(toTouch, DB_CHUNK)) {
    const { error } = await withPostgrestTransientRetry("membership.touch", async () =>
      supabase
        .from("ipon_category_membership")
        .update({ last_seen_at: now })
        .eq("supplier_category_id", supplierCategoryId)
        .in("supplier_product_id", part)
    );
    if (error) throw new Error(`membership touch: ${error.message}`);
  }

  for (const part of chunks(toDelete, DB_CHUNK)) {
    const { error } = await withPostgrestTransientRetry("membership.delete", async () =>
      supabase
        .from("ipon_category_membership")
        .delete()
        .eq("supplier_category_id", supplierCategoryId)
        .in("supplier_product_id", part)
    );
    if (error) throw new Error(`membership delete: ${error.message}`);
  }
}

async function saveMembershipStatus(
  supabase: SupabaseClient,
  rowId: string,
  status: IponMembershipStatus,
  expected: number | null,
  fetched: number,
  complete: boolean
): Promise<void> {
  const patch: Record<string, unknown> = {
    membership_status: status,
    membership_expected: expected,
    membership_fetched: fetched,
    updated_at: new Date().toISOString()
  };
  if (complete) patch.membership_synced_at = new Date().toISOString();
  const { error } = await supabase.from("supplier_categories").update(patch).eq("id", rowId);
  if (error) throw new Error(`membership status: ${error.message}`);
}

export type SyncMembershipResult = {
  status: IponMembershipStatus;
  requests: number;
  fetched: number;
  expected: number | null;
  captcha: boolean;
};

/**
 * Pages one filtered row. Stops without deleting when the budget runs out or iPon blocks.
 */
export async function syncFilteredCategoryMembership(
  supabase: SupabaseClient,
  row: IponMappedCategory,
  jar: Map<string, string>,
  session: MutableSession,
  requestBudget: { remaining: number }
): Promise<SyncMembershipResult> {
  if (!row.listingUrl) {
    return { status: "failed", requests: 0, fetched: 0, expected: null, captcha: false };
  }

  const seen = new Set<string>();
  let expected: number | null = null;
  let requests = 0;
  let captcha = false;
  let failed = false;
  let cutOff = false;
  let lastPageShort = false;
  let page = 1;

  try {
    while (page <= 500) {
      if (requestBudget.remaining <= 0) {
        cutOff = true;
        break;
      }
      if (requests > 0) await pauseBetweenIponCalls();
      const url = buildIponListProductsUrl(row.listingUrl, page, row.filtered);
      requestBudget.remaining -= 1;
      requests += 1;
      const parsed = await fetchListPage(url, row.listingUrl, jar, session);
      if (expected == null && parsed.total != null) expected = parsed.total;
      const pageSize = parsed.pageSize ?? LIST_PAGE_SIZE;
      if (parsed.ids.length === 0) {
        lastPageShort = true;
        break;
      }
      let added = 0;
      for (const id of parsed.ids) {
        if (!seen.has(id)) {
          seen.add(id);
          added += 1;
        }
      }
      if (added === 0) {
        failed = true;
        break;
      }
      if (expected != null && seen.size >= expected) break;
      if (parsed.ids.length < pageSize) {
        lastPageShort = true;
        break;
      }
      page += 1;
    }
    if (page > 500) failed = true;
  } catch (error) {
    if (error instanceof IponCaptchaError) captcha = true;
    else {
      failed = true;
      console.warn(
        `[iPon membership] ${row.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const countMatches = expected != null ? seen.size === expected : lastPageShort && seen.size > 0;
  const complete = !captcha && !failed && !cutOff && countMatches;
  const status: IponMembershipStatus = complete ? "complete" : failed && !captcha && !cutOff ? "failed" : "incomplete";

  if (complete) {
    await replaceMembership(supabase, row.id, Array.from(seen));
  }
  await saveMembershipStatus(supabase, row.id, status, expected, seen.size, complete);

  return { status, requests, fetched: seen.size, expected, captcha };
}

function categoryEmbed(raw: Record<string, unknown>): { name: string | null; pointer: boolean } {
  const value = raw.categories;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return { name: null, pointer: false };
  const rec = row as Record<string, unknown>;
  const pointer = typeof rec.view_source_category_id === "string" && rec.view_source_category_id.length > 0;
  const name = typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : null;
  return { name, pointer };
}

export function mapSupplierCategoryRow(raw: Record<string, unknown>): IponMappedCategory | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const internalCategoryId = typeof raw.internal_category_id === "string" ? raw.internal_category_id : null;
  if (!id || !internalCategoryId) return null;
  if (categoryEmbed(raw).pointer) return null;
  const listingUrl = typeof raw.listing_url === "string" && raw.listing_url.trim() ? raw.listing_url.trim() : null;
  let groupKey =
    typeof raw.supplier_category_key === "string" && raw.supplier_category_key.trim()
      ? raw.supplier_category_key.trim()
      : null;
  if (!groupKey && listingUrl) {
    try {
      groupKey = String(parseGroupIdFromListingUrl(listingUrl));
    } catch {
      groupKey = null;
    }
  }
  const status = raw.membership_status;
  const membershipStatus =
    status === "complete" || status === "incomplete" || status === "failed" ? status : null;
  const manual = manualFeedPathFromInput(
    typeof raw.manual_feed_path === "string" ? raw.manual_feed_path : null
  );
  const category = categoryEmbed(raw);
  return {
    id,
    internalCategoryId,
    categoryName: category.name,
    groupKey,
    listingUrl,
    feedCategoryPath:
      typeof raw.feed_category_path === "string" && raw.feed_category_path.trim()
        ? raw.feed_category_path.trim()
        : null,
    manualFeedPath: "error" in manual ? null : manual.path,
    filtered: Boolean(listingUrl && listingUrlHasFilterParams(listingUrl)),
    productGroups: [],
    listReady: false,
    productGroupLearnedAt:
      typeof raw.product_group_learned_at === "string" ? raw.product_group_learned_at : null,
    membershipStatus,
    membershipSyncedAt: typeof raw.membership_synced_at === "string" ? raw.membership_synced_at : null
  };
}

export async function loadIponMappedCategories(supabase: SupabaseClient): Promise<IponMappedCategory[]> {
  const { data, error } = await withPostgrestTransientRetry("supplier_categories.ipon-map", async () =>
    supabase
      .from("supplier_categories")
      .select(
        "id, internal_category_id, supplier_category_key, listing_url, feed_category_path, manual_feed_path, membership_synced_at, membership_status, product_group_learned_at, is_active, categories(name, view_source_category_id)"
      )
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  );
  if (error) throw new Error(`supplier_categories: ${error.message}`);
  const rows: IponMappedCategory[] = [];
  let pointers = 0;
  for (const raw of data ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (categoryEmbed(record).pointer) {
      pointers += 1;
      continue;
    }
    const mapped = mapSupplierCategoryRow(record);
    if (mapped) rows.push(mapped);
  }
  if (pointers > 0) console.log(`[iPon categories] Preskočeno pokazivača: ${pointers}`);
  return rows;
}

export type MembershipRotationResult = {
  rowsSynced: number;
  incomplete: number;
  requests: number;
  captcha: boolean;
};

export async function rotateFilteredMembership(
  supabase: SupabaseClient,
  rows: IponMappedCategory[],
  jar: Map<string, string>,
  session: MutableSession,
  options?: { dryRun?: boolean; maxRequests?: number }
): Promise<MembershipRotationResult> {
  const maxRequests = options?.maxRequests ?? numEnv("IPON_MEMBERSHIP_MAX_REQUESTS", 150);
  const filtered = rows
    .filter((row) => row.filtered && row.listingUrl && row.groupKey)
    .sort((a, b) => {
      const at = a.membershipSyncedAt ? Date.parse(a.membershipSyncedAt) : 0;
      const bt = b.membershipSyncedAt ? Date.parse(b.membershipSyncedAt) : 0;
      return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0);
    });

  if (options?.dryRun) {
    console.log(`[iPon membership] Dry-run: ${filtered.length} filtriranih redova, bez list poziva.`);
    return { rowsSynced: 0, incomplete: 0, requests: 0, captcha: false };
  }

  const budget = { remaining: maxRequests };
  let rowsSynced = 0;
  let incomplete = 0;
  let requests = 0;
  let captcha = false;

  for (const row of filtered) {
    if (budget.remaining <= 0 || captcha) break;
    console.log(
      `[iPon membership] Sync ${row.groupKey} → ${row.internalCategoryId} (preostalo zahtjeva ${budget.remaining})`
    );
    const result = await syncFilteredCategoryMembership(supabase, row, jar, session, budget);
    requests += result.requests;
    if (result.captcha) captcha = true;
    if (result.status === "complete") rowsSynced += 1;
    else incomplete += 1;
    console.log(
      `[iPon membership] ${row.id}: ${result.status} fetched=${result.fetched} expected=${result.expected ?? "?"}`
    );
  }

  return { rowsSynced, incomplete, requests, captcha };
}

export async function learnMissingFeedCategoryPaths(
  supabase: SupabaseClient,
  rows: IponMappedCategory[],
  categoryById: Map<string, string>,
  jar: Map<string, string>,
  session: MutableSession,
  options?: { dryRun?: boolean; maxRequests?: number }
): Promise<{ learned: number; requests: number; captcha: boolean }> {
  const maxRequests = options?.maxRequests ?? numEnv("IPON_PATH_LEARN_MAX", 40);
  const byGroup = new Map<string, IponMappedCategory[]>();
  for (const row of rows) {
    if (!row.groupKey) continue;
    const list = byGroup.get(row.groupKey) ?? [];
    list.push(row);
    byGroup.set(row.groupKey, list);
  }

  let learned = 0;
  let requests = 0;
  let captcha = false;

  for (const [groupKey, groupRows] of Array.from(byGroup.entries())) {
    if (captcha) break;
    const known = groupRows.find((row) => row.feedCategoryPath)?.feedCategoryPath ?? null;
    const missing = groupRows.filter((row) => !row.feedCategoryPath);
    if (missing.length === 0) continue;

    let path = known;
    if (!path) {
      const sample = groupRows.find((row) => row.listingUrl);
      if (!sample?.listingUrl) continue;
      if (requests >= maxRequests) continue;
      try {
        if (requests > 0) await pauseBetweenIponCalls();
        const url = buildIponListProductsUrl(sample.listingUrl, 1, false);
        requests += 1;
        const page = await fetchListPage(url, sample.listingUrl, jar, session);
        path = dominantFeedPath(page.ids, categoryById);
      } catch (error) {
        if (error instanceof IponCaptchaError) {
          captcha = true;
          break;
        }
        console.warn(
          `[iPon paths] grupa ${groupKey}:`,
          error instanceof Error ? error.message : String(error)
        );
        continue;
      }
    }

    if (!path) {
      console.warn(`[iPon paths] grupa ${groupKey}: nema dominantne feed kategorije.`);
      continue;
    }

    for (const row of missing) row.feedCategoryPath = path;
    if (options?.dryRun) {
      learned += missing.length;
      console.log(`[iPon paths] Dry-run grupa ${groupKey}: ${path} (${missing.length} redova)`);
      continue;
    }

    const ids = missing.map((row) => row.id);
    const { error } = await supabase.from("supplier_categories").update({ feed_category_path: path }).in("id", ids);
    if (error) {
      console.warn(`[iPon paths] upis ${groupKey}:`, error.message);
      continue;
    }
    for (const row of missing) row.feedCategoryPath = path;
    learned += ids.length;
    console.log(`[iPon paths] grupa ${groupKey}: ${path} (${ids.length} redova)`);
  }

  return { learned, requests, captcha };
}

function dominantFeedPath(ids: string[], categoryById: Map<string, string>): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const path = categoryById.get(id);
    if (!path) continue;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  let top: { path: string; count: number } | null = null;
  let found = 0;
  for (const entry of Array.from(counts.entries())) {
    const path = entry[0];
    const count = entry[1];
    found += count;
    if (!top || count > top.count) top = { path, count };
  }
  if (!top || found < 5) return null;
  if (top.count / found < 0.8) return null;
  return top.path;
}
