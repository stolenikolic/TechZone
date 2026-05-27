/**
 * PCX: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-pcx-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { aggregatePrices, reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { createSupabaseServiceClient } from "utils/supabase";
import { getSupplierCategories } from "lib/suppliers/registry";
import {
  hasLikelyProductDetailHtml,
  isSupplierDetailBlocked,
  isSupplierListingBlocked,
  isSupplierWarmupBlocked
} from "lib/suppliers/shared/bot-challenge";
import { collectAdditionalProperty, type SpecRow, type SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import { PCX_CATEGORIES } from "./categories";

const PCX_SUPPLIER_ID = "f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3";

type PcxCategory = (typeof PCX_CATEGORIES)[number];

/**
 * DB-first list of PCX categories. Falls back to hardcoded `PCX_CATEGORIES`
 * (the registry already encapsulates that fallback, but the local check is
 * defensive against an unexpected empty result).
 */
async function resolvePcxCategoriesFromRegistry(): Promise<PcxCategory[]> {
  const rows = await getSupplierCategories(PCX_SUPPLIER_ID);
  if (rows.length === 0) return PCX_CATEGORIES;
  const out: PcxCategory[] = [];
  for (const row of rows) {
    if (!row.listingUrl) continue;
    const fallback = PCX_CATEGORIES.find((c) => c.url === row.listingUrl);
    out.push({ name: fallback?.name ?? row.supplierCategoryKey ?? "category", url: row.listingUrl });
  }
  return out.length > 0 ? out : PCX_CATEGORIES;
}
const BASE_ORIGIN = "https://www.pcx.hu";
/** Default cap per run (original spec). Set env `PCX_MAX_PRODUCTS_PER_RUN=0` for no limit (full category). */
const DEFAULT_MAX_PRODUCTS_PER_RUN = 5;

function getMaxProductsPerRun(): number {
  const raw = process.env.PCX_MAX_PRODUCTS_PER_RUN;
  if (raw === undefined || raw === "") return DEFAULT_MAX_PRODUCTS_PER_RUN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_PRODUCTS_PER_RUN;
  if (n === 0) return Number.MAX_SAFE_INTEGER;
  return n;
}

function buildCategoryListUrl(categoryUrl: string, page: number): string {
  if (page <= 1) return categoryUrl;
  const u = new URL(categoryUrl);
  // PCX listing pagination uses `oldal` (Hungarian: page).
  u.searchParams.set("oldal", String(page));
  return u.toString();
}

/**
 * Anti-WAF strategy (mirrors FirstShop):
 *   1. Session cookie jar — homepage warmup before scrape.
 *   2. Full Chrome 122 header set (sec-ch-ua / sec-fetch-*).
 *   3. Referer chain: homepage → listing → PDP.
 *   4. 1.5–3 s jittered delay between requests.
 *   5. Retry 521/502/503 with backoff; re-warmup before final attempt.
 */
const PCX_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const REQUEST_DELAY_MIN_MS = 1500;
const REQUEST_DELAY_JITTER_MS = 1500;
const TRANSIENT_HTTP_STATUSES = new Set([521, 502, 503]);
const TRANSIENT_RETRY_BACKOFF_MS = [5000, 15000] as const;

function delayMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredDelayMs(): number {
  return REQUEST_DELAY_MIN_MS + Math.floor(Math.random() * (REQUEST_DELAY_JITTER_MS + 1));
}

/** Cookie jar — name → value. Persists across all requests within one run. */
const cookieJar = new Map<string, string>();

function getCookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function ingestSetCookies(res: Response): void {
  type ResponseWithGetSetCookie = Response & { headers: Headers & { getSetCookie?: () => string[] } };
  const headers = (res as ResponseWithGetSetCookie).headers;
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const firstSemi = cookie.indexOf(";");
    const pair = firstSemi >= 0 ? cookie.slice(0, firstSemi) : cookie;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    cookieJar.set(name, value);
  }
}

type PcxFetchKind = "homepage" | "listing" | "pdp";

function buildPcxHeaders(kind: PcxFetchKind, referer: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": PCX_USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    Connection: "keep-alive",
    "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": kind === "homepage" || !referer ? "none" : "same-origin",
    "sec-fetch-user": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
  if (referer) headers.Referer = referer;
  const cookie = getCookieHeader();
  if (cookie) headers.Cookie = cookie;
  return headers;
}

type PcxFetchOptions = {
  kind?: PcxFetchKind;
  referer?: string | null;
  skipDelay?: boolean;
};

let isFirstHttpRequest = true;
let lastPcxUrl: string | null = null;

function parseHttpStatusFromPcxError(message: string): number | null {
  const m = message.match(/\[PCX\] HTTP (\d+) for /);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function fetchPcxHtmlOnce(url: string, options: PcxFetchOptions = {}): Promise<string> {
  const kind: PcxFetchKind = options.kind ?? "pdp";
  const referer = options.referer === undefined ? lastPcxUrl : options.referer;

  if (!isFirstHttpRequest && !options.skipDelay) {
    await delayMs(jitteredDelayMs());
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, { headers: buildPcxHeaders(kind, referer) });
  ingestSetCookies(res);

  if (!res.ok) {
    throw new Error(`[PCX] HTTP ${res.status} for ${url}`);
  }
  lastPcxUrl = url;
  return res.text();
}

async function fetchPcxHtml(url: string, options: PcxFetchOptions = {}): Promise<string> {
  const maxAttempts = 1 + TRANSIENT_RETRY_BACKOFF_MS.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const backoff = TRANSIENT_RETRY_BACKOFF_MS[attempt - 1];
      if (attempt === maxAttempts - 1) {
        console.warn(`[PCX][retry] re-warmup before final attempt for ${url}`);
        await warmupPcxSession();
      }
      console.warn(`[PCX][retry] attempt=${attempt + 1}/${maxAttempts} backoff=${backoff}ms url=${url}`);
      await delayMs(backoff);
    }

    try {
      return await fetchPcxHtmlOnce(url, options);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const status = parseHttpStatusFromPcxError(lastError.message);
      if (status == null || !TRANSIENT_HTTP_STATUSES.has(status) || attempt >= maxAttempts - 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`[PCX] fetch failed for ${url}`);
}

function resetPcxHttpState(): void {
  cookieJar.clear();
  isFirstHttpRequest = true;
  lastPcxUrl = null;
}

/** Warmup: GET homepage to receive anti-bot session cookies before scraping. */
async function warmupPcxSession(): Promise<void> {
  const homepageHtml = await fetchPcxHtmlOnce(`${BASE_ORIGIN}/`, {
    kind: "homepage",
    referer: null,
    skipDelay: true
  });
  if (isSupplierWarmupBlocked(homepageHtml)) {
    throw new Error("[PCX] Stopped: bot challenge page detected (homepage warmup).");
  }
  console.log(`[PCX][warmup] homepage OK, cookies=${cookieJar.size}`);
}

type PcxListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
  /** PCX internal listing id from `data-prod-iden` (reference only). */
  pcxProdIden: string | null;
};

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${BASE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function findNextListingCardIndex(html: string, from: number): number {
  const i1 = html.indexOf('<div class="islide-elem"', from);
  const i2 = html.indexOf('<div class="obox', from);
  if (i1 >= 0 && i2 >= 0) return Math.min(i1, i2);
  if (i1 >= 0) return i1;
  if (i2 >= 0) return i2;
  return -1;
}

function parseListPriceFromBlock(block: string): number | null {
  const realIdx = block.indexOf("real-price");
  const slice = realIdx >= 0 ? block.slice(realIdx) : block;
  const priceMeta = slice.match(/<meta content="(\d+)" itemprop="price">/i);
  if (!priceMeta) return null;
  const listPrice = Number(priceMeta[1]);
  return Number.isFinite(listPrice) ? listPrice : null;
}

/**
 * Listing cards: islide promó + `obox` grid — both have `data-prod-iden` and `prod-name` link.
 */
export function parseCategoryListingHtml(html: string): PcxListingItem[] {
  const seen = new Set<string>();
  const out: PcxListingItem[] = [];

  let start = findNextListingCardIndex(html, 0);
  while (start >= 0) {
    const next = findNextListingCardIndex(html, start + 1);
    const block = next === -1 ? html.slice(start) : html.slice(start, next);

    let linkM = block.match(
      /<a[^>]*class="[^"]*prod-name[^"]*islide-elem-name[^"]*"[^>]*href="([^"]+)"[^>]*title="([^"]*)"/i
    );
    if (!linkM) {
      linkM = block.match(
        /<a[^>]*class="[^"]*prod-name[^"]*"[^>]*href="([^"]+)"[^>]*title="([^"]*)"/i
      );
    }
    if (linkM) {
      const href = linkM[1];
      const name = linkM[2].trim();
      const supplierProductUrl = absoluteUrl(href);
      const idenMatch = block.match(/\bdata-prod-iden="([^"]*)"/i);
      const pcxProdIden = idenMatch?.[1]?.trim() || null;
      if (!seen.has(supplierProductUrl)) {
        seen.add(supplierProductUrl);
        const listPrice = parseListPriceFromBlock(block);
        out.push({ supplierProductUrl, name, listPrice, pcxProdIden });
      }
    }

    start = findNextListingCardIndex(html, start + 1);
  }

  return out;
}

function parseJsonLdProduct(html: string): Record<string, unknown> | null {
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi;
  let block: RegExpExecArray | null;
  while ((block = re.exec(html)) !== null) {
    try {
      const o = JSON.parse(block[1]) as Record<string, unknown>;
      if (o["@type"] === "Product") return o;
      const graph = o["@graph"];
      if (Array.isArray(graph)) {
        const p = graph.find((x) => (x as { "@type"?: string })["@type"] === "Product") as
          | Record<string, unknown>
          | undefined;
        if (p) return p;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type PcxDetailParsed = {
  mpn: string | null;
  ean: string | null;
  price: number | null;
  /** Store "Cikkszám" from PDP `prod-code` block (stable offer id). */
  cikkszam: string | null;
  /** JSON-LD Product.sku (often same as Cikkszám on PCX). */
  ldSku: string | null;
  /** PDP display name → `raw_json.product_name`. */
  productName: string | null;
  /** Main product image URL → `raw_json.image_url`. */
  imageUrl: string | null;
  /** Spec rows from JSON-LD additionalProperty — used for spec_snapshot. */
  specRows: SpecRow[];
};

/**
 * Extracts PCX article code from the product detail HTML (`prod-code` / Cikkszám).
 */
export function extractCikkszamFromPcxDetailHtml(html: string): string | null {
  const m = html.match(/data-stat-elem="name:product_code"[^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i);
  if (!m?.[1]) return null;
  const v = m[1].replace(/\s+/g, "").trim();
  return v.length > 0 ? v : null;
}

function pickLdImageUrl(ld: Record<string, unknown> | null): string | null {
  if (!ld) return null;
  const img = ld.image;
  if (typeof img === "string" && img.trim()) return img.trim();
  if (Array.isArray(img) && img.length > 0) {
    const first = img[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object" && "url" in first) {
      const u = (first as { url?: unknown }).url;
      if (typeof u === "string" && u.trim()) return u.trim();
    }
  }
  return null;
}

function extractOgTitle(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  const stripped = raw.replace(/\s*\|\s*pcx\.hu\s*$/i, "").trim();
  return stripped.length > 0 ? stripped : null;
}

function extractOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const v = m?.[1]?.trim();
  return v && v.length > 0 ? v : null;
}

function extractItempropName(html: string): string | null {
  const m = html.match(/<meta[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i);
  const v = m?.[1]?.trim();
  return v && v.length > 0 ? v : null;
}

/**
 * Display fields for `raw_json.product_name` / `raw_json.image_url` (PDP HTML).
 * Exported for one-off DB backfill scripts.
 */
export function extractPcxProductNameAndImageFromDetailHtml(html: string): {
  product_name: string | null;
  image_url: string | null;
} {
  const d = parseProductDetailHtml(html);
  return { product_name: d.productName, image_url: d.imageUrl };
}

function parseProductDetailHtml(html: string): PcxDetailParsed {
  const ld = parseJsonLdProduct(html);
  let mpn: string | null = null;
  let ean: string | null = null;
  let price: number | null = null;
  let ldSku: string | null = null;
  let productName: string | null = null;
  let imageUrl: string | null = null;

  if (ld) {
    if (typeof ld.mpn === "string" && ld.mpn.trim()) mpn = ld.mpn.trim();
    if (typeof ld.sku === "string" && ld.sku.trim()) ldSku = ld.sku.trim();
    if (typeof ld.name === "string" && ld.name.trim()) productName = ld.name.trim();
    if (typeof ld.gtin13 === "string" && ld.gtin13.trim()) ean = ld.gtin13.trim();
    if (typeof ld.gtin === "string" && ld.gtin.trim() && !ean) ean = ld.gtin.trim();
    if (typeof ld.gtin14 === "string" && ld.gtin14.trim() && !ean) ean = ld.gtin14.trim();

    const offers = ld.offers as Record<string, unknown> | undefined;
    if (offers && typeof offers === "object") {
      price = numOrNull(offers.price);
    }
    imageUrl = pickLdImageUrl(ld);
  }

  if (!productName) productName = extractOgTitle(html);
  if (!productName) productName = extractItempropName(html);

  if (!imageUrl) imageUrl = extractOgImage(html);

  const cikkszam = extractCikkszamFromPcxDetailHtml(html);

  const specRows: SpecRow[] = [];
  if (ld) collectAdditionalProperty(ld, specRows);

  return {
    mpn,
    ean,
    price,
    cikkszam,
    ldSku,
    productName,
    imageUrl,
    specRows
  };
}

function resolvePcxSupplierProductId(detail: PcxDetailParsed): string | null {
  const fromHtml = detail.cikkszam?.replace(/\s+/g, "").trim();
  if (fromHtml) return fromHtml;
  const fromSku = detail.ldSku?.replace(/\s+/g, "").trim();
  if (fromSku) return fromSku;
  const mpnN = normalizeMpn(detail.mpn);
  if (mpnN) return mpnN;
  return null;
}

async function deactivateStalePcxOffersInCategory(
  supabase: SupabaseClient,
  categoryName: string,
  fetchedSupplierProductIds: Set<string>
): Promise<number> {
  if (fetchedSupplierProductIds.size === 0) return 0;

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id")
    .eq("supplier_id", PCX_SUPPLIER_ID)
    .contains("raw_json", { category: categoryName });

  if (error) {
    console.warn("[PCX] stale offers lookup:", error.message);
    return 0;
  }
  if (!rows?.length) return 0;

  const staleIds = rows
    .map((r) => r.supplier_product_id)
    .filter((id) => !fetchedSupplierProductIds.has(id));

  if (staleIds.length === 0) return 0;

  const { error: uErr } = await supabase
    .from("supplier_products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("supplier_id", PCX_SUPPLIER_ID)
    .in("supplier_product_id", staleIds);

  if (uErr) {
    console.warn("[PCX] stale offers deactivate:", uErr.message);
    return 0;
  }

  return staleIds.length;
}

let remainingSlots = DEFAULT_MAX_PRODUCTS_PER_RUN;
let supabaseSingleton: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseSingleton) supabaseSingleton = createSupabaseServiceClient();
  return supabaseSingleton;
}

/**
 * Conditionally saves spec_snapshot for a PCX supplier_products row.
 * Only writes if spec_snapshot IS NULL (first import). Non-fatal on error.
 */
async function maybeSavePcxSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  detail: PcxDetailParsed
): Promise<void> {
  try {
    const snapshot: SpecSnapshot = {
      mpn: detail.mpn,
      ean: detail.ean,
      factory_link: null,
      specs: detail.specRows
    };
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("supplier_products")
      .update({ spec_snapshot: snapshot, specs_fetched_at: now, updated_at: now })
      .eq("supplier_id", PCX_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId)
      .is("spec_snapshot", null);
    if (error) console.warn("[PCX] spec_snapshot save:", error.message);
  } catch (err) {
    console.warn("[PCX] spec_snapshot save unexpected:", err instanceof Error ? err.message : String(err));
  }
}

export type PcxCategoryImportStats = {
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateCikkszam: number;
  staleDeactivated: number;
};

/**
 * Import one category until the global per-run cap is reached.
 */
export async function importCategory(category: (typeof PCX_CATEGORIES)[number]): Promise<PcxCategoryImportStats> {
  const supabase = getSupabase();

  const stats: PcxCategoryImportStats = {
    upserted: 0,
    skippedNoPrice: 0,
    skippedNoSupplierProductId: 0,
    skippedDuplicateCikkszam: 0,
    staleDeactivated: 0
  };

  if (remainingSlots <= 0) return stats;

  const seenUrlsThisCategory = new Set<string>();
  const seenCikkszamThisCategory = new Set<string>();
  let page = 1;
  let stoppedDueToSlotCap = false;

  while (remainingSlots > 0 && page <= 200) {
    const listUrl = buildCategoryListUrl(category.url, page);
    const listHtml = await fetchPcxHtml(listUrl, { kind: "listing" });

    const pageItems = parseCategoryListingHtml(listHtml);
    if (isSupplierListingBlocked(listHtml, pageItems.length)) {
      throw new Error("[PCX] Stopped: bot challenge page detected (category listing).");
    }
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    console.log(
      `[PCX][page] category=${category.name} page=${page} listUrl=${listUrl} pageItems=${pageItems.length} newItems=${newItems.length} seenUrls=${seenUrlsThisCategory.size} remainingSlots=${remainingSlots}`
    );

    if (pageItems.length === 0) {
      console.log(`[PCX][page-stop] category=${category.name} page=${page} reason=empty_page_items`);
      break;
    }
    if (newItems.length === 0) {
      console.log(`[PCX][page-stop] category=${category.name} page=${page} reason=no_new_items`);
      break;
    }

    for (const item of newItems) {
      if (remainingSlots <= 0) {
        stoppedDueToSlotCap = true;
        break;
      }

      const detailHtml = await fetchPcxHtml(item.supplierProductUrl, {
        kind: "pdp",
        referer: listUrl
      });
      const hasProductSignals = hasLikelyProductDetailHtml(detailHtml);
      if (isSupplierDetailBlocked(detailHtml, hasProductSignals)) {
        throw new Error("[PCX] Stopped: bot challenge page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml);
      const supplierProductId = resolvePcxSupplierProductId(detail);
      if (!supplierProductId) {
        console.warn("[PCX] Skip (no Cikkszám / sku / mpn):", item.supplierProductUrl);
        stats.skippedNoSupplierProductId += 1;
        continue;
      }
      if (seenCikkszamThisCategory.has(supplierProductId)) {
        console.warn("[PCX] Skip (duplicate Cikkszám in category):", supplierProductId, item.supplierProductUrl);
        stats.skippedDuplicateCikkszam += 1;
        continue;
      }

      const mpnN = normalizeMpn(detail.mpn);
      const eanN = normalizeEan(detail.ean);

      const priceFromDetail = detail.price;
      const priceAmount =
        priceFromDetail != null && Number.isFinite(priceFromDetail)
          ? priceFromDetail
          : item.listPrice != null
            ? item.listPrice
            : null;

      if (priceAmount == null || !Number.isFinite(priceAmount)) {
        console.warn("[PCX] Skip (no price):", item.supplierProductUrl);
        stats.skippedNoPrice += 1;
        continue;
      }

      seenCikkszamThisCategory.add(supplierProductId);

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
          throw new Error(`[PCX] products identifiers lookup: ${masterIdentifiersError.message}`);
        }
        const identifierSync = getIdentifierSyncUpdate(
          { mpn: mpnN, ean: eanN },
          { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
        );
        resolvedMpn = identifierSync.update.mpn ?? mpnN;
        resolvedEan = identifierSync.update.ean ?? eanN;
      }

      const rawJson: Record<string, unknown> = {
        source: "pcx",
        category: category.name,
        listing_name: item.name,
        url: item.supplierProductUrl,
        pcx_prod_iden: item.pcxProdIden,
        matchAudit: match.audit
      };
      if (detail.productName) rawJson.product_name = detail.productName;
      if (detail.imageUrl) rawJson.image_url = detail.imageUrl;

      const row = {
        supplier_id: PCX_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        ean: resolvedEan,
        is_active: true,
        enrichment_status: "complete" as const,
        master_match_status: productId ? ("linked" as const) : ("pending_review" as const),
        raw_json: rawJson,
        updated_at: new Date().toISOString()
      };

      const { error: upErr } = await supabase.from("supplier_products").upsert(row, {
        onConflict: "supplier_id,supplier_product_id"
      });

      if (upErr) {
        throw new Error(`[PCX] supplier_products upsert: ${upErr.message}`);
      }

      await maybeSavePcxSpecSnapshot(supabase, supplierProductId, detail);

      stats.upserted += 1;
      remainingSlots -= 1;
      console.log(
        `[PCX] ${category.name} — ${item.name.slice(0, 60)}… id=${supplierProductId} mpn=${mpnN ?? "(null)"} ean=${eanN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} HUF`
      );
    }

    if (stoppedDueToSlotCap) {
      console.log(`[PCX][page-stop] category=${category.name} page=${page} reason=slot_cap_reached`);
      break;
    }

    page += 1;
  }

  if (!stoppedDueToSlotCap) {
    stats.staleDeactivated = await deactivateStalePcxOffersInCategory(
      supabase,
      category.name,
      seenCikkszamThisCategory
    );
  }
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[PCX] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  return stats;
}

export type PcxImportResult = {
  success: boolean;
  remainingSlots: number;
  error?: string;
  summary?: {
    categories: number;
    upserted: number;
    skipped_no_price: number;
    skipped_no_supplier_product_id: number;
    skipped_duplicate_cikkszam: number;
    stale_deactivated: number;
    aggregate_updated: number;
    aggregate_batches: number;
    aggregate_error?: string;
    aggregate_warnings?: string[];
  };
};

export type PcxSupplierCategoryImportInput = {
  listingUrl: string;
  /** Label za log / job summary (npr. ime interne kategorije). */
  name?: string;
};

export function buildPcxCategoryFromSupplierRow(input: PcxSupplierCategoryImportInput): PcxCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za PCX import ove kategorije.");
  }
  return {
    name: input.name ?? "category",
    url
  };
}

export type PcxSingleCategoryImportResult = {
  success: boolean;
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateCikkszam: number;
  staleDeactivated: number;
  pricesAggregated: number;
  summary: {
    single_category: true;
    category_name: string;
    upserted: number;
    skipped_no_price: number;
    skipped_no_supplier_product_id: number;
    skipped_duplicate_cikkszam: number;
    stale_deactivated: number;
    prices_aggregated: number;
    aggregate_batches?: number;
    aggregate_error?: string;
    aggregate_warnings?: string[];
  };
};

/**
 * Ručni import jedne kategorije (jedan red supplier_categories).
 * Ne mijenja ponašanje `runPcxImportProducts` (pun sync svih kategorija s cap-om po runu).
 */
export async function runPcxImportForSupplierCategory(
  input: PcxSupplierCategoryImportInput
): Promise<PcxSingleCategoryImportResult> {
  const category = buildPcxCategoryFromSupplierRow(input);
  remainingSlots = Number.MAX_SAFE_INTEGER;
  isFirstHttpRequest = true;
  supabaseSingleton = createSupabaseServiceClient();

  const stats = await importCategory(category);
  const agg = await aggregatePrices();

  console.log("[PCX import] Jedna kategorija završena.", {
    category: category.name,
    upserted: stats.upserted,
    skippedNoPrice: stats.skippedNoPrice,
    staleDeactivated: stats.staleDeactivated,
    pricesUpdated: agg.updated
  });

  return {
    success: !agg.error,
    upserted: stats.upserted,
    skippedNoPrice: stats.skippedNoPrice,
    skippedNoSupplierProductId: stats.skippedNoSupplierProductId,
    skippedDuplicateCikkszam: stats.skippedDuplicateCikkszam,
    staleDeactivated: stats.staleDeactivated,
    pricesAggregated: agg.updated,
    summary: {
      single_category: true,
      category_name: category.name,
      upserted: stats.upserted,
      skipped_no_price: stats.skippedNoPrice,
      skipped_no_supplier_product_id: stats.skippedNoSupplierProductId,
      skipped_duplicate_cikkszam: stats.skippedDuplicateCikkszam,
      stale_deactivated: stats.staleDeactivated,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };
}

/**
 * Resets per-run throttle, then imports every category in `PCX_CATEGORIES`
 * until the global cap is reached (env `PCX_MAX_PRODUCTS_PER_RUN`, default 5; `0` = no limit).
 */
export async function runPcxImportProducts(): Promise<PcxImportResult> {
  remainingSlots = getMaxProductsPerRun();
  resetPcxHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  const summary = {
    categories: 0,
    upserted: 0,
    skipped_no_price: 0,
    skipped_no_supplier_product_id: 0,
    skipped_duplicate_cikkszam: 0,
    stale_deactivated: 0,
    aggregate_updated: 0,
    aggregate_batches: 0,
    aggregate_error: undefined as string | undefined,
    aggregate_warnings: undefined as string[] | undefined
  };

  try {
    await warmupPcxSession();
    const categories = await resolvePcxCategoriesFromRegistry();
    summary.categories = categories.length;
    for (const category of categories) {
      const s = await importCategory(category);
      summary.upserted += s.upserted;
      summary.skipped_no_price += s.skippedNoPrice;
      summary.skipped_no_supplier_product_id += s.skippedNoSupplierProductId;
      summary.skipped_duplicate_cikkszam += s.skippedDuplicateCikkszam;
      summary.stale_deactivated += s.staleDeactivated;
    }
    const agg = await aggregatePrices();
    summary.aggregate_updated = agg.updated;
    summary.aggregate_batches = agg.batches;
    if (agg.error) {
      summary.aggregate_error = agg.error;
      console.warn("[PCX] aggregate-prices:", agg.error);
    }
    if (agg.warnings?.length) {
      summary.aggregate_warnings = agg.warnings;
    }
    return { success: !agg.error, remainingSlots, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return { success: false, remainingSlots, error: msg, summary };
  }
}

export { PCX_SUPPLIER_ID };
