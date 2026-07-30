/**
 * FirstShop: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-firstshop-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupplierProductMatchSafe } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn, mpnMatchKeyFromMpn } from "lib/suppliers/normalizeProductIdentifiers";
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
import type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import { FIRSTSHOP_SUPPLIER_ID } from "./constants";
import { FIRSTSHOP_CATEGORIES, type FirstshopCategory } from "./categories";

const BASE_ORIGIN = "https://firstshop.hu";

/** Default cap per run. `FIRSTSHOP_MAX_PRODUCTS_PER_RUN=0` = no limit. */
const DEFAULT_MAX_PRODUCTS_PER_RUN = 5;

function getMaxProductsPerRun(): number {
  const raw = process.env.FIRSTSHOP_MAX_PRODUCTS_PER_RUN;
  if (raw === undefined || raw === "") return DEFAULT_MAX_PRODUCTS_PER_RUN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_PRODUCTS_PER_RUN;
  if (n === 0) return Number.MAX_SAFE_INTEGER;
  return n;
}

async function resolveFirstshopCategoriesFromRegistry(): Promise<FirstshopCategory[]> {
  const rows = await getSupplierCategories(FIRSTSHOP_SUPPLIER_ID);
  if (rows.length === 0) return FIRSTSHOP_CATEGORIES;
  const out: FirstshopCategory[] = [];
  for (const row of rows) {
    if (!row.listingUrl) continue;
    const fallback = FIRSTSHOP_CATEGORIES.find((c) => c.url === row.listingUrl);
    out.push({
      categoryKey: row.supplierCategoryKey ?? fallback?.categoryKey ?? "category",
      url: row.listingUrl
    });
  }
  return out.length > 0 ? out : FIRSTSHOP_CATEGORIES;
}

function buildCategoryListUrl(categoryUrl: string, page: number): string {
  if (page <= 1) return categoryUrl;
  const u = new URL(categoryUrl);
  u.searchParams.set("p", String(page));
  return u.toString();
}

/**
 * Anti-WAF strategy (without a real browser):
 *   1. Session cookie jar — homepage warmup issues anti-bot cookies that PDP requests must echo.
 *   2. Full Chrome 122 header set (sec-ch-ua / sec-fetch-*) — many WAFs gate on these.
 *   3. Referer chain mirrors a human path: homepage → listing → PDP → next listing.
 *   4. keep-alive across all requests; let undici auto-decompress (no manual Accept-Encoding).
 *   5. 1.5–3 s jittered delay between requests — no fixed cadence.
 */
const FIRSTSHOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const REQUEST_DELAY_MIN_MS = 1500;
const REQUEST_DELAY_JITTER_MS = 1500;

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

type FirstshopFetchKind = "homepage" | "listing" | "pdp";

function buildFirstshopHeaders(kind: FirstshopFetchKind, referer: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": FIRSTSHOP_USER_AGENT,
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

type FirstshopFetchOptions = {
  kind?: FirstshopFetchKind;
  referer?: string | null;
  skipDelay?: boolean;
};

let isFirstHttpRequest = true;
let lastFirstshopUrl: string | null = null;

async function fetchFirstshopHtml(
  url: string,
  options: FirstshopFetchOptions = {}
): Promise<string> {
  const kind: FirstshopFetchKind = options.kind ?? "pdp";
  const referer = options.referer === undefined ? lastFirstshopUrl : options.referer;

  if (!isFirstHttpRequest && !options.skipDelay) {
    await delayMs(jitteredDelayMs());
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, { headers: buildFirstshopHeaders(kind, referer) });
  ingestSetCookies(res);

  if (!res.ok) {
    throw new Error(`[FirstShop] HTTP ${res.status} for ${url}`);
  }
  lastFirstshopUrl = url;
  return res.text();
}

function resetFirstshopHttpState(): void {
  cookieJar.clear();
  isFirstHttpRequest = true;
  lastFirstshopUrl = null;
}

/** Warmup: GET homepage to receive any anti-bot session cookies before scraping. */
async function warmupFirstshopSession(): Promise<void> {
  const homepageHtml = await fetchFirstshopHtml(`${BASE_ORIGIN}/`, {
    kind: "homepage",
    referer: null,
    skipDelay: true
  });
  if (isSupplierWarmupBlocked(homepageHtml)) {
    throw new Error("[FirstShop] Stopped: bot challenge page detected (homepage warmup).");
  }
  console.log(`[FirstShop][warmup] homepage OK, cookies=${cookieJar.size}`);
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${BASE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function parseHufPriceFromText(text: string): number | null {
  const content = text.match(/itemprop="price"\s+content="(\d+)"/i);
  if (content) {
    const n = Number(content[1]);
    if (Number.isFinite(n)) return n;
  }
  const m = text.match(/class="price-new"[^>]*>([\d\s]+)\s*Ft/i);
  if (m) {
    const n = Number(m[1].replace(/\s/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type FirstshopListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
  /** Numeric id from URL suffix `-p{id}` (reference). */
  urlProductId: string | null;
};

const LISTING_CARD_MARKER = 'class="product-col list clearfix boxContainer"';

/**
 * Listing cards on category pages (firstshop.hu).
 */
export function parseCategoryListingHtml(html: string): FirstshopListingItem[] {
  const seen = new Set<string>();
  const out: FirstshopListingItem[] = [];
  const parts = html.split(LISTING_CARD_MARKER);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const linkM =
      block.match(
        /<h4[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*title="([^"]*)"/i
      ) ?? block.match(/<a[^>]+href="(https:\/\/firstshop\.hu\/[^"]+-p\d+)"[^>]*title="([^"]*)"/i);
    if (!linkM) continue;

    const href = linkM[1].trim();
    const name = linkM[2].trim();
    if (!/-p\d+/i.test(href)) continue;

    const supplierProductUrl = absoluteUrl(href);
    if (seen.has(supplierProductUrl)) continue;
    seen.add(supplierProductUrl);

    out.push({
      supplierProductUrl,
      name,
      listPrice: parseHufPriceFromText(block),
      urlProductId: extractFirstshopProductIdFromUrl(supplierProductUrl)
    });
  }
  return out;
}

/** Max pagination page from `data-page` links (e.g. Utolsó (8)). */
export function parseMaxListingPage(html: string): number {
  let max = 1;
  const re = /data-page="(\d+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function extractFirstshopProductIdFromUrl(url: string): string | null {
  const m = url.match(/-p(\d+)(?:\?|$|\/)/i) ?? url.match(/-p(\d+)$/i);
  return m?.[1]?.trim() || null;
}

const CIKKSZAM_CELL_RE =
  /<td>\s*Cikkszám\s*<\/td>\s*<td class="value">[\s\S]*?<span itemprop="mpn">([^<]+)<\/span>/i;

/** Compact Cikkszám (no spaces) — stable `supplier_product_id`, unchanged across re-imports. */
export function extractCikkszamFromDetailHtml(html: string): string | null {
  const m = html.match(CIKKSZAM_CELL_RE);
  if (!m?.[1]) return null;
  const v = m[1].replace(/\s+/g, "").trim();
  return v.length > 0 ? v : null;
}

/** Cikkszám with natural spacing — used for `mpn` / matching (aligned with PCX JSON-LD style). */
export function extractCikkszamMpnFromDetailHtml(html: string): string | null {
  const m = html.match(CIKKSZAM_CELL_RE);
  if (!m?.[1]) return null;
  const v = stripHtmlTags(m[1]);
  return v.length > 0 ? v : null;
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Small info table (Azonosító, Gyártó, Cikkszám, …) on PDP. */
export function parseSmallInfoTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const slice = html.slice(0, html.indexOf('id="prodSpec"') > 0 ? html.indexOf('id="prodSpec"') : 120000);
  const re = /<tr>\s*<td>([^<]+)<\/td>\s*<td class="value">([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const name = m[1].trim();
    const value = stripHtmlTags(m[2]);
    if (name && value) out[name] = value;
  }
  return out;
}

/** SPECIFIKÁCIÓ table → spec rows. */
export function parseProductAttributesTable(html: string): SpecRow[] {
  const rows: SpecRow[] = [];
  const re =
    /<td class="AttributeName">([^<]*)<\/td>\s*<td class="AttributeValue">([^<]*)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (name && value) rows.push({ name, value });
  }
  return rows;
}

function extractOgMeta(html: string, property: string): string | null {
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
  const v = m?.[1]?.trim();
  return v && v.length > 0 ? v : null;
}

type FirstshopDetailParsed = {
  mpn: string | null;
  ean: string | null;
  price: number | null;
  cikkszam: string | null;
  urlProductId: string | null;
  productName: string | null;
  imageUrl: string | null;
  smallInfo: Record<string, string>;
  specRows: SpecRow[];
};

export function parseProductDetailHtml(html: string, productUrl?: string): FirstshopDetailParsed {
  let productName = extractOgMeta(html, "og:title");
  if (productName) {
    productName = productName.replace(/\s*\|\s*firstshop\.hu\s*$/i, "").trim();
  }
  if (!productName) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1?.[1]) productName = stripHtmlTags(h1[1]);
  }

  const imageUrl = extractOgMeta(html, "og:image");
  const cikkszam = extractCikkszamFromDetailHtml(html);
  const smallInfo = parseSmallInfoTable(html);
  const specRows = parseProductAttributesTable(html);
  const price = parseHufPriceFromText(html);

  const mpnRaw = smallInfo.Cikkszám ?? extractCikkszamMpnFromDetailHtml(html);
  const mpn = mpnRaw ? normalizeMpn(mpnRaw) : null;

  return {
    mpn,
    ean: null,
    price,
    cikkszam,
    urlProductId: productUrl ? extractFirstshopProductIdFromUrl(productUrl) : null,
    productName,
    imageUrl,
    smallInfo,
    specRows
  };
}

export function resolveFirstshopSupplierProductId(detail: FirstshopDetailParsed): string | null {
  const fromCikkszam = detail.cikkszam?.replace(/\s+/g, "").trim();
  if (fromCikkszam) return fromCikkszam;
  if (detail.urlProductId) return detail.urlProductId;
  const mpnN = normalizeMpn(detail.mpn);
  if (mpnN) return mpnN;
  return null;
}

async function deactivateStaleFirstshopOffersInCategory(
  supabase: SupabaseClient,
  categoryKey: string,
  fetchedSupplierProductIds: Set<string>
): Promise<number> {
  if (fetchedSupplierProductIds.size === 0) return 0;

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id")
    .eq("supplier_id", FIRSTSHOP_SUPPLIER_ID)
    .contains("raw_json", { category: categoryKey });

  if (error) {
    console.warn("[FirstShop] stale offers lookup:", error.message);
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
    .eq("supplier_id", FIRSTSHOP_SUPPLIER_ID)
    .in("supplier_product_id", staleIds);

  if (uErr) {
    console.warn("[FirstShop] stale offers deactivate:", uErr.message);
    return 0;
  }

  return staleIds.length;
}

async function maybeSaveFirstshopSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  detail: FirstshopDetailParsed
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
      .eq("supplier_id", FIRSTSHOP_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId)
      .is("spec_snapshot", null);
    if (error) console.warn("[FirstShop] spec_snapshot save:", error.message);
  } catch (err) {
    console.warn(
      "[FirstShop] spec_snapshot save unexpected:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

let remainingSlots = DEFAULT_MAX_PRODUCTS_PER_RUN;
let supabaseSingleton: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseSingleton) supabaseSingleton = createSupabaseServiceClient();
  return supabaseSingleton;
}

export type FirstshopCategoryImportStats = {
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateId: number;
  staleDeactivated: number;
};

export async function importCategory(category: FirstshopCategory): Promise<FirstshopCategoryImportStats> {
  const supabase = getSupabase();

  const stats: FirstshopCategoryImportStats = {
    upserted: 0,
    skippedNoPrice: 0,
    skippedNoSupplierProductId: 0,
    skippedDuplicateId: 0,
    staleDeactivated: 0
  };

  if (remainingSlots <= 0) return stats;

  const seenUrlsThisCategory = new Set<string>();
  const seenIdsThisCategory = new Set<string>();
  let page = 1;
  let stoppedDueToSlotCap = false;
  let maxPage = 200;

  while (remainingSlots > 0 && page <= maxPage) {
    const listUrl = buildCategoryListUrl(category.url, page);
    const listHtml = await fetchFirstshopHtml(listUrl, { kind: "listing" });

    if (page === 1) {
      maxPage = parseMaxListingPage(listHtml);
    }

    const pageItems = parseCategoryListingHtml(listHtml);
    if (isSupplierListingBlocked(listHtml, pageItems.length)) {
      throw new Error("[FirstShop] Stopped: bot challenge page detected (category listing).");
    }
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    console.log(
      `[FirstShop][page] category=${category.categoryKey} page=${page}/${maxPage} listUrl=${listUrl} pageItems=${pageItems.length} newItems=${newItems.length} seenUrls=${seenUrlsThisCategory.size} remainingSlots=${remainingSlots}`
    );

    if (pageItems.length === 0) {
      console.log(`[FirstShop][page-stop] category=${category.categoryKey} page=${page} reason=empty_page_items`);
      break;
    }
    if (newItems.length === 0) {
      console.log(`[FirstShop][page-stop] category=${category.categoryKey} page=${page} reason=no_new_items`);
      break;
    }

    for (const item of newItems) {
      if (remainingSlots <= 0) {
        stoppedDueToSlotCap = true;
        break;
      }

      const detailHtml = await fetchFirstshopHtml(item.supplierProductUrl, {
        kind: "pdp",
        referer: listUrl
      });
      const hasProductSignals =
        hasLikelyProductDetailHtml(detailHtml) || !!extractCikkszamFromDetailHtml(detailHtml);
      if (isSupplierDetailBlocked(detailHtml, hasProductSignals)) {
        throw new Error("[FirstShop] Stopped: bot challenge page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml, item.supplierProductUrl);
      const supplierProductId = resolveFirstshopSupplierProductId(detail);
      if (!supplierProductId) {
        console.warn("[FirstShop] Skip (no Cikkszám / url id):", item.supplierProductUrl);
        stats.skippedNoSupplierProductId += 1;
        continue;
      }
      if (seenIdsThisCategory.has(supplierProductId)) {
        console.warn(
          "[FirstShop] Skip (duplicate id in category):",
          supplierProductId,
          item.supplierProductUrl
        );
        stats.skippedDuplicateId += 1;
        continue;
      }

      const mpnN = normalizeMpn(detail.mpn);
      const eanN = normalizeEan(detail.ean);

      const priceAmount =
        detail.price != null && Number.isFinite(detail.price)
          ? detail.price
          : item.listPrice != null
            ? item.listPrice
            : null;

      if (priceAmount == null || !Number.isFinite(priceAmount)) {
        console.warn("[FirstShop] Skip (no price):", item.supplierProductUrl);
        stats.skippedNoPrice += 1;
        continue;
      }

      seenIdsThisCategory.add(supplierProductId);

      const match = await resolveSupplierProductMatchSafe(supabase, { ean: eanN, mpn: mpnN });
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
          throw new Error(`[FirstShop] products identifiers lookup: ${masterIdentifiersError.message}`);
        }
        const identifierSync = getIdentifierSyncUpdate(
          { mpn: mpnN, ean: eanN },
          { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
        );
        resolvedMpn = identifierSync.update.mpn ?? mpnN;
        resolvedEan = identifierSync.update.ean ?? eanN;
      }

      const rawJson: Record<string, unknown> = {
        source: "firstshop",
        category: category.categoryKey,
        listing_name: item.name,
        url: item.supplierProductUrl,
        url_product_id: item.urlProductId,
        small_info: detail.smallInfo,
        matchAudit: match.audit
      };
      if (detail.productName) rawJson.product_name = detail.productName;
      if (detail.imageUrl) rawJson.image_url = detail.imageUrl;

      const row = {
        supplier_id: FIRSTSHOP_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
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
        throw new Error(`[FirstShop] supplier_products upsert: ${upErr.message}`);
      }

      await maybeSaveFirstshopSpecSnapshot(supabase, supplierProductId, detail);

      stats.upserted += 1;
      remainingSlots -= 1;
      console.log(
        `[FirstShop] ${category.categoryKey} — ${item.name.slice(0, 60)}… id=${supplierProductId} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} HUF`
      );
    }

    if (stoppedDueToSlotCap) {
      console.log(`[FirstShop][page-stop] category=${category.categoryKey} page=${page} reason=slot_cap_reached`);
      break;
    }

    page += 1;
  }

  if (!stoppedDueToSlotCap) {
    stats.staleDeactivated = await deactivateStaleFirstshopOffersInCategory(
      supabase,
      category.categoryKey,
      seenIdsThisCategory
    );
  }
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[FirstShop] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  return stats;
}

export type FirstshopImportResult = {
  success: boolean;
  remainingSlots: number;
  error?: string;
  summary?: {
    categories: number;
    upserted: number;
    skipped_no_price: number;
    skipped_no_supplier_product_id: number;
    skipped_duplicate_id: number;
    stale_deactivated: number;
    aggregate_updated: number;
    aggregate_batches: number;
    aggregate_error?: string;
    aggregate_warnings?: string[];
  };
};

export type FirstshopSupplierCategoryImportInput = {
  listingUrl: string;
  categoryKey?: string;
  name?: string;
};

export function buildFirstshopCategoryFromSupplierRow(
  input: FirstshopSupplierCategoryImportInput
): FirstshopCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za FirstShop import ove kategorije.");
  }
  return {
    categoryKey: input.categoryKey ?? input.name ?? "category",
    url
  };
}

export type FirstshopSingleCategoryImportResult = {
  success: boolean;
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateId: number;
  staleDeactivated: number;
  pricesAggregated: number;
  summary: {
    single_category: true;
    category_name: string;
    upserted: number;
    skipped_no_price: number;
    skipped_no_supplier_product_id: number;
    skipped_duplicate_id: number;
    stale_deactivated: number;
    prices_aggregated: number;
    aggregate_batches?: number;
    aggregate_error?: string;
    aggregate_warnings?: string[];
  };
};

export async function runFirstshopImportForSupplierCategory(
  input: FirstshopSupplierCategoryImportInput
): Promise<FirstshopSingleCategoryImportResult> {
  const category = buildFirstshopCategoryFromSupplierRow(input);
  remainingSlots = Number.MAX_SAFE_INTEGER;
  resetFirstshopHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  await warmupFirstshopSession();
  const stats = await importCategory(category);
  const agg = await aggregatePrices();

  console.log("[FirstShop import] Jedna kategorija završena.", {
    category: category.categoryKey,
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
    skippedDuplicateId: stats.skippedDuplicateId,
    staleDeactivated: stats.staleDeactivated,
    pricesAggregated: agg.updated,
    summary: {
      single_category: true,
      category_name: category.categoryKey,
      upserted: stats.upserted,
      skipped_no_price: stats.skippedNoPrice,
      skipped_no_supplier_product_id: stats.skippedNoSupplierProductId,
      skipped_duplicate_id: stats.skippedDuplicateId,
      stale_deactivated: stats.staleDeactivated,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };
}

export async function runFirstshopImportProducts(): Promise<FirstshopImportResult> {
  remainingSlots = getMaxProductsPerRun();
  resetFirstshopHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  const summary = {
    categories: 0,
    upserted: 0,
    skipped_no_price: 0,
    skipped_no_supplier_product_id: 0,
    skipped_duplicate_id: 0,
    stale_deactivated: 0,
    aggregate_updated: 0,
    aggregate_batches: 0,
    aggregate_error: undefined as string | undefined,
    aggregate_warnings: undefined as string[] | undefined
  };

  try {
    await warmupFirstshopSession();
    const categories = await resolveFirstshopCategoriesFromRegistry();
    summary.categories = categories.length;
    for (const category of categories) {
      const s = await importCategory(category);
      summary.upserted += s.upserted;
      summary.skipped_no_price += s.skippedNoPrice;
      summary.skipped_no_supplier_product_id += s.skippedNoSupplierProductId;
      summary.skipped_duplicate_id += s.skippedDuplicateId;
      summary.stale_deactivated += s.staleDeactivated;
    }
    const agg = await aggregatePrices();
    summary.aggregate_updated = agg.updated;
    summary.aggregate_batches = agg.batches;
    if (agg.error) {
      summary.aggregate_error = agg.error;
      console.warn("[FirstShop] aggregate-prices:", agg.error);
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

export { FIRSTSHOP_SUPPLIER_ID };
