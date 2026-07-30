/**
 * PCLand: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-pcland-import-products.ts
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
import { PCLAND_SUPPLIER_ID } from "./constants";
import { PCLAND_CATEGORIES, type PclandCategory } from "./categories";
import { computePclandDeliveryDays, parsePclandStockContextFromDetailHtml } from "./delivery-days";

const BASE_ORIGIN = "https://pcland.hu";

/** Default cap per run. `PCLAND_MAX_PRODUCTS_PER_RUN=0` = no limit. */
const DEFAULT_MAX_PRODUCTS_PER_RUN = 5;

function getMaxProductsPerRun(): number {
  const raw = process.env.PCLAND_MAX_PRODUCTS_PER_RUN;
  if (raw === undefined || raw === "") return DEFAULT_MAX_PRODUCTS_PER_RUN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_PRODUCTS_PER_RUN;
  if (n === 0) return Number.MAX_SAFE_INTEGER;
  return n;
}

async function resolvePclandCategoriesFromRegistry(): Promise<PclandCategory[]> {
  const rows = await getSupplierCategories(PCLAND_SUPPLIER_ID);
  if (rows.length === 0) return PCLAND_CATEGORIES;
  const out: PclandCategory[] = [];
  for (const row of rows) {
    if (!row.listingUrl) continue;
    const fallback = PCLAND_CATEGORIES.find((c) => c.url === row.listingUrl);
    out.push({
      categoryKey: row.supplierCategoryKey ?? fallback?.categoryKey ?? "category",
      url: row.listingUrl
    });
  }
  return out.length > 0 ? out : PCLAND_CATEGORIES;
}

export function buildCategoryListUrl(categoryUrl: string, page: number): string {
  if (page <= 1) return categoryUrl;
  const u = new URL(categoryUrl);
  u.searchParams.set("page", String(page));
  return u.toString();
}

const PCLAND_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const REQUEST_DELAY_MIN_MS = 1500;
const REQUEST_DELAY_JITTER_MS = 1500;

function delayMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredDelayMs(): number {
  return REQUEST_DELAY_MIN_MS + Math.floor(Math.random() * (REQUEST_DELAY_JITTER_MS + 1));
}

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

type PclandFetchKind = "homepage" | "listing" | "pdp";

function buildPclandHeaders(kind: PclandFetchKind, referer: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": PCLAND_USER_AGENT,
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

type PclandFetchOptions = {
  kind?: PclandFetchKind;
  referer?: string | null;
  skipDelay?: boolean;
};

let isFirstHttpRequest = true;
let lastPclandUrl: string | null = null;

async function fetchPclandHtml(url: string, options: PclandFetchOptions = {}): Promise<string> {
  const kind: PclandFetchKind = options.kind ?? "pdp";
  const referer = options.referer === undefined ? lastPclandUrl : options.referer;

  if (!isFirstHttpRequest && !options.skipDelay) {
    await delayMs(jitteredDelayMs());
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, { headers: buildPclandHeaders(kind, referer) });
  ingestSetCookies(res);

  if (!res.ok) {
    throw new Error(`[PCLand] HTTP ${res.status} for ${url}`);
  }
  lastPclandUrl = url;
  return res.text();
}

function resetPclandHttpState(): void {
  cookieJar.clear();
  isFirstHttpRequest = true;
  lastPclandUrl = null;
}

async function warmupPclandSession(): Promise<void> {
  const homepageHtml = await fetchPclandHtml(`${BASE_ORIGIN}/`, {
    kind: "homepage",
    referer: null,
    skipDelay: true
  });
  if (isSupplierWarmupBlocked(homepageHtml)) {
    throw new Error("[PCLand] Stopped: bot challenge page detected (homepage warmup).");
  }
  console.log(`[PCLand][warmup] homepage OK, cookies=${cookieJar.size}`);
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${BASE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseHufPriceFromText(text: string): number | null {
  const content = text.match(/itemprop="price"\s+content="(\d+)"/i);
  if (content) {
    const n = Number(content[1]);
    if (Number.isFinite(n)) return n;
  }
  const m = text.match(/class="product-price[^"]*"[^>]*>([\d\s.]+)\s*Ft/i);
  if (m) {
    const n = Number(m[1].replace(/[\s.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type PclandListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
  urlProductId: string | null;
  stockLabel: string | null;
};

const LISTING_CARD_MARKER = 'class="product-snapshot list_div_item"';

export function parseCategoryListingHtml(html: string): PclandListingItem[] {
  const seen = new Set<string>();
  const out: PclandListingItem[] = [];
  const parts = html.split(LISTING_CARD_MARKER);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const linkM =
      block.match(
        /<h2[^>]*class="[^"]*product-card-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*title="([^"]*)"/i
      ) ??
      block.match(/<a[^>]+href="(https:\/\/pcland\.hu\/[^"]+)"[^>]*title="([^"]*)"/i);
    if (!linkM) continue;

    const href = linkM[1].trim();
    const name = linkM[2].trim();
    if (!href.includes("pcland.hu") && !href.startsWith("/")) continue;

    const supplierProductUrl = absoluteUrl(href);
    if (seen.has(supplierProductUrl)) continue;
    seen.add(supplierProductUrl);

    const stockM = block.match(
      /class="[^"]*product-card-stock[^"]*"[^>]*>\s*([^<]+)/i
    );

    out.push({
      supplierProductUrl,
      name,
      listPrice: parseHufPriceFromText(block),
      urlProductId: extractPclandProductIdFromUrl(supplierProductUrl),
      stockLabel: stockM?.[1]?.trim() ?? null
    });
  }
  return out;
}

export function parseMaxListingPage(html: string): number {
  let max = 1;
  const re = /[?&]page=(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function extractPclandProductIdFromUrl(url: string): string | null {
  const m = url.match(/-(\d+)(?:\?|#|$)/) ?? url.match(/-(\d+)$/);
  return m?.[1]?.trim() || null;
}

export function parseVonalkodEan(html: string): string | null {
  const m = html.match(
    /class="param-value product-gtin-param"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
  );
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  const eanPart = raw.includes("|") ? raw.split("|")[0] : raw;
  return normalizeEan(eanPart);
}

export function extractCikkszamFromDetailHtml(html: string): string | null {
  const m =
    html.match(
      /class="param-value productsku-param"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
    ) ?? html.match(/Cikkszám:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
  if (!m?.[1]) return null;
  const v = stripHtmlTags(m[1]).replace(/\s+/g, "").trim();
  return v.length > 0 ? v : null;
}

export function extractGyartoCikkszamFromDetailHtml(html: string): string | null {
  const m = html.match(
    /class="param-value manufacturersku-param"[^>]*>([^<]+)</i
  );
  if (!m?.[1]) return null;
  const v = stripHtmlTags(m[1]);
  return v.length > 0 ? v : null;
}

export function parseProductAttributesTable(html: string): SpecRow[] {
  const rows: SpecRow[] = [];
  const tableM = html.match(/<table class="parameter-table[^"]*"[\s\S]*?<\/table>/i);
  if (!tableM) return rows;
  const re = /<tr>\s*<td>([^<]*)<\/td>\s*<td>(?:<strong>)?([^<]*?)(?:<\/strong>)?<\/td>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableM[0])) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (!name || !value) continue;
    if (!value && name.length > 40) continue;
    rows.push({ name, value });
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

type PclandDetailParsed = {
  mpn: string | null;
  ean: string | null;
  price: number | null;
  cikkszam: string | null;
  gyartoCikkszam: string | null;
  urlProductId: string | null;
  productName: string | null;
  imageUrl: string | null;
  stockContext: ReturnType<typeof parsePclandStockContextFromDetailHtml>;
  deliveryDays: number;
  specRows: SpecRow[];
};

export function parseProductDetailHtml(html: string, productUrl?: string): PclandDetailParsed {
  let productName = extractOgMeta(html, "og:title");
  if (productName) {
    productName = productName.replace(/\s*-\s*[^|]+\|\s*PCLAND\s*$/i, "").trim();
    productName = productName.replace(/\s*\|\s*pcland\.hu\s*$/i, "").trim();
  }
  if (!productName) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1?.[1]) productName = stripHtmlTags(h1[1]);
  }

  const imageUrl = extractOgMeta(html, "og:image");
  const cikkszam = extractCikkszamFromDetailHtml(html);
  const gyartoCikkszam = extractGyartoCikkszamFromDetailHtml(html);
  const ean = parseVonalkodEan(html);
  const specRows = parseProductAttributesTable(html);
  const price = parseHufPriceFromText(html);
  const stockContext = parsePclandStockContextFromDetailHtml(html);
  const deliveryDays = computePclandDeliveryDays(html);

  const mpnRaw = gyartoCikkszam;
  const mpn = mpnRaw ? normalizeMpn(mpnRaw) : null;

  return {
    mpn,
    ean,
    price,
    cikkszam,
    gyartoCikkszam,
    urlProductId: productUrl ? extractPclandProductIdFromUrl(productUrl) : null,
    productName,
    imageUrl,
    stockContext,
    deliveryDays,
    specRows
  };
}

export function resolvePclandSupplierProductId(detail: PclandDetailParsed): string | null {
  const fromCikkszam = detail.cikkszam?.replace(/\s+/g, "").trim();
  if (fromCikkszam) return fromCikkszam;
  if (detail.urlProductId) return detail.urlProductId;
  const mpnN = normalizeMpn(detail.mpn);
  if (mpnN) return mpnN;
  return null;
}

async function deactivateStalePclandOffersInCategory(
  supabase: SupabaseClient,
  categoryKey: string,
  fetchedSupplierProductIds: Set<string>
): Promise<number> {
  if (fetchedSupplierProductIds.size === 0) return 0;

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id")
    .eq("supplier_id", PCLAND_SUPPLIER_ID)
    .contains("raw_json", { category: categoryKey });

  if (error) {
    console.warn("[PCLand] stale offers lookup:", error.message);
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
    .eq("supplier_id", PCLAND_SUPPLIER_ID)
    .in("supplier_product_id", staleIds);

  if (uErr) {
    console.warn("[PCLand] stale offers deactivate:", uErr.message);
    return 0;
  }

  return staleIds.length;
}

async function maybeSavePclandSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  detail: PclandDetailParsed
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
      .eq("supplier_id", PCLAND_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId)
      .is("spec_snapshot", null);
    if (error) console.warn("[PCLand] spec_snapshot save:", error.message);
  } catch (err) {
    console.warn(
      "[PCLand] spec_snapshot save unexpected:",
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

export type PclandCategoryImportStats = {
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateId: number;
  staleDeactivated: number;
};

export async function importCategory(category: PclandCategory): Promise<PclandCategoryImportStats> {
  const supabase = getSupabase();

  const stats: PclandCategoryImportStats = {
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
    const listHtml = await fetchPclandHtml(listUrl, { kind: "listing" });

    if (page === 1) {
      maxPage = parseMaxListingPage(listHtml);
    }

    const pageItems = parseCategoryListingHtml(listHtml);
    if (isSupplierListingBlocked(listHtml, pageItems.length)) {
      throw new Error("[PCLand] Stopped: bot challenge page detected (category listing).");
    }
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    console.log(
      `[PCLand][page] category=${category.categoryKey} page=${page}/${maxPage} listUrl=${listUrl} pageItems=${pageItems.length} newItems=${newItems.length} seenUrls=${seenUrlsThisCategory.size} remainingSlots=${remainingSlots}`
    );

    if (pageItems.length === 0) {
      console.log(`[PCLand][page-stop] category=${category.categoryKey} page=${page} reason=empty_page_items`);
      break;
    }
    if (newItems.length === 0) {
      console.log(`[PCLand][page-stop] category=${category.categoryKey} page=${page} reason=no_new_items`);
      break;
    }

    for (const item of newItems) {
      if (remainingSlots <= 0) {
        stoppedDueToSlotCap = true;
        break;
      }

      const detailHtml = await fetchPclandHtml(item.supplierProductUrl, {
        kind: "pdp",
        referer: listUrl
      });
      const hasProductSignals =
        hasLikelyProductDetailHtml(detailHtml) || !!extractCikkszamFromDetailHtml(detailHtml);
      if (isSupplierDetailBlocked(detailHtml, hasProductSignals)) {
        throw new Error("[PCLand] Stopped: bot challenge page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml, item.supplierProductUrl);
      const supplierProductId = resolvePclandSupplierProductId(detail);
      if (!supplierProductId) {
        console.warn("[PCLand] Skip (no Cikkszám / url id):", item.supplierProductUrl);
        stats.skippedNoSupplierProductId += 1;
        continue;
      }
      if (seenIdsThisCategory.has(supplierProductId)) {
        console.warn(
          "[PCLand] Skip (duplicate id in category):",
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
        console.warn("[PCLand] Skip (no price):", item.supplierProductUrl);
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
          throw new Error(`[PCLand] products identifiers lookup: ${masterIdentifiersError.message}`);
        }
        const identifierSync = getIdentifierSyncUpdate(
          { mpn: mpnN, ean: eanN },
          { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
        );
        resolvedMpn = identifierSync.update.mpn ?? mpnN;
        resolvedEan = identifierSync.update.ean ?? eanN;
      }

      const rawJson: Record<string, unknown> = {
        source: "pcland",
        category: category.categoryKey,
        listing_name: item.name,
        url: item.supplierProductUrl,
        url_product_id: item.urlProductId,
        cikkszam: detail.cikkszam,
        gyarto_cikkszam: detail.gyartoCikkszam,
        stock_status: detail.stockContext.stockLabel ?? item.stockLabel,
        stock_status_id: detail.stockContext.stockStatusId,
        portal_shipping_days: detail.stockContext.portalShippingDays,
        matchAudit: match.audit
      };
      if (detail.productName) rawJson.product_name = detail.productName;
      if (detail.imageUrl) rawJson.image_url = detail.imageUrl;

      const row = {
        supplier_id: PCLAND_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
        ean: resolvedEan,
        delivery_days: detail.deliveryDays,
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
        throw new Error(`[PCLand] supplier_products upsert: ${upErr.message}`);
      }

      await maybeSavePclandSpecSnapshot(supabase, supplierProductId, detail);

      stats.upserted += 1;
      remainingSlots -= 1;
      console.log(
        `[PCLand] ${category.categoryKey} — ${item.name.slice(0, 60)}… id=${supplierProductId} ean=${eanN ?? "(null)"} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} delivery_days=${detail.deliveryDays}`
      );
    }

    if (stoppedDueToSlotCap) {
      console.log(`[PCLand][page-stop] category=${category.categoryKey} page=${page} reason=slot_cap_reached`);
      break;
    }

    page += 1;
  }

  if (!stoppedDueToSlotCap) {
    stats.staleDeactivated = await deactivateStalePclandOffersInCategory(
      supabase,
      category.categoryKey,
      seenIdsThisCategory
    );
  }
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[PCLand] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  return stats;
}

export type PclandImportResult = {
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

export type PclandSupplierCategoryImportInput = {
  listingUrl: string;
  categoryKey?: string;
  name?: string;
};

export function buildPclandCategoryFromSupplierRow(
  input: PclandSupplierCategoryImportInput
): PclandCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za PCLand import ove kategorije.");
  }
  return {
    categoryKey: input.categoryKey ?? input.name ?? "category",
    url
  };
}

export type PclandSingleCategoryImportResult = {
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

export async function runPclandImportForSupplierCategory(
  input: PclandSupplierCategoryImportInput
): Promise<PclandSingleCategoryImportResult> {
  const category = buildPclandCategoryFromSupplierRow(input);
  remainingSlots = Number.MAX_SAFE_INTEGER;
  resetPclandHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  await warmupPclandSession();
  const stats = await importCategory(category);
  const agg = await aggregatePrices();

  console.log("[PCLand import] Jedna kategorija završena.", {
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

export async function runPclandImportProducts(): Promise<PclandImportResult> {
  remainingSlots = getMaxProductsPerRun();
  resetPclandHttpState();
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
    await warmupPclandSession();
    const categories = await resolvePclandCategoriesFromRegistry();
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
      console.warn("[PCLand] aggregate-prices:", agg.error);
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

export { PCLAND_SUPPLIER_ID };
