/**
 * Oázis Computer: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-oazis-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeMpn, mpnMatchKeyFromMpn } from "lib/suppliers/normalizeProductIdentifiers";
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
import { OAZIS_SUPPLIER_ID } from "./constants";
import { OAZIS_CATEGORIES, type OazisCategory } from "./categories";
import { parseOazisDeliveryDays, parseOazisWarrantyMonths } from "./delivery-days";

const BASE_ORIGIN = "https://oaziscomputer.hu";

/** Default cap per run. `OAZIS_MAX_PRODUCTS_PER_RUN=0` = no limit. */
const DEFAULT_MAX_PRODUCTS_PER_RUN = 5;

function getMaxProductsPerRun(): number {
  const raw = process.env.OAZIS_MAX_PRODUCTS_PER_RUN;
  if (raw === undefined || raw === "") return DEFAULT_MAX_PRODUCTS_PER_RUN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_PRODUCTS_PER_RUN;
  if (n === 0) return Number.MAX_SAFE_INTEGER;
  return n;
}

async function resolveOazisCategoriesFromRegistry(): Promise<OazisCategory[]> {
  const rows = await getSupplierCategories(OAZIS_SUPPLIER_ID);
  if (rows.length === 0) return OAZIS_CATEGORIES;
  const out: OazisCategory[] = [];
  for (const row of rows) {
    if (!row.listingUrl) continue;
    const fallback = OAZIS_CATEGORIES.find((c) => c.url === row.listingUrl);
    out.push({
      categoryKey: row.supplierCategoryKey ?? fallback?.categoryKey ?? "category",
      url: row.listingUrl
    });
  }
  return out.length > 0 ? out : OAZIS_CATEGORIES;
}

/** Path pagination: `/processzor/1`, `/processzor/2` — no query param. */
export function buildCategoryListUrl(categoryUrl: string, page: number): string {
  const base = categoryUrl.replace(/\/\d+\/?$/, "");
  const p = Math.max(1, page);
  return `${base}/${p}`;
}

const OAZIS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const REQUEST_DELAY_MIN_MS = 2000;
const REQUEST_DELAY_JITTER_MS = 2000;

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

type OazisFetchKind = "homepage" | "listing" | "pdp";

function buildOazisHeaders(kind: OazisFetchKind, referer: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": OAZIS_USER_AGENT,
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

type OazisFetchOptions = {
  kind?: OazisFetchKind;
  referer?: string | null;
  skipDelay?: boolean;
};

let isFirstHttpRequest = true;
let lastOazisUrl: string | null = null;

async function fetchOazisHtml(url: string, options: OazisFetchOptions = {}): Promise<string> {
  const kind: OazisFetchKind = options.kind ?? "pdp";
  const referer = options.referer === undefined ? lastOazisUrl : options.referer;

  if (!isFirstHttpRequest && !options.skipDelay) {
    await delayMs(jitteredDelayMs());
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, {
    headers: buildOazisHeaders(kind, referer),
    signal: AbortSignal.timeout(120_000)
  });
  ingestSetCookies(res);

  if (!res.ok) {
    throw new Error(`[Oázis] HTTP ${res.status} for ${url}`);
  }
  lastOazisUrl = url;
  return res.text();
}

function resetOazisHttpState(): void {
  cookieJar.clear();
  isFirstHttpRequest = true;
  lastOazisUrl = null;
}

async function warmupOazisSession(): Promise<void> {
  const homepageHtml = await fetchOazisHtml(`${BASE_ORIGIN}/`, {
    kind: "homepage",
    referer: null,
    skipDelay: true
  });
  if (isSupplierWarmupBlocked(homepageHtml)) {
    throw new Error("[Oázis] Stopped: bot challenge page detected (homepage warmup).");
  }
  console.log(`[Oázis][warmup] homepage OK, cookies=${cookieJar.size}`);
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${BASE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Strip tracking query params (`?aku=`) for deduplication. */
export function normalizeOazisProductUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("aku");
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url;
  }
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Brutto HUF — `gross` span, og:price meta, or first `N Ft` not followed by `+ Áfa`. */
export function parseOazisBruttoHufPrice(text: string): number | null {
  const grossM = text.match(/class="gross"[^>]*>[\s\S]*?<strong>([\d\s]+)\s*Ft/i);
  if (grossM) {
    const n = Number(grossM[1].replace(/\s/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }

  const metaM = text.match(/product:price:amount"[^>]+content="(\d+)"/i);
  if (metaM) {
    const n = Number(metaM[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const pricesM = text.match(/class="prices"[^>]*>\s*<strong>([\d\s]+)\s*Ft/i);
  if (pricesM) {
    const n = Number(pricesM[1].replace(/\s/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }

  const re = /(\d[\d\s]+)\s*Ft/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (/\+\s*(?:&Aacute;|Á)fa/i.test(after)) continue;
    const n = Number(m[1].replace(/\s/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export type OazisListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
  urlProductId: string | null;
  termekkod: string | null;
  stockLabel: string | null;
};

const PRODUCT_CARD_RE = /<div class="product">([\s\S]*?)<div class="product_footer"><\/div>/gi;

function extractTermekkodFromListingBlock(block: string): string | null {
  const spanM = block.match(/<span>\(([^)]+)\)<\/span>/i);
  const raw = spanM?.[1]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function extractAvailabilityFromBlock(block: string): string | null {
  const m =
    block.match(/Rendelhető,\s*\d+\s*-\s*\d+\s*munkanap/i) ??
    block.match(/Rendelhető,\s*\d+\s*munkanap/i) ??
    block.match(/\d+\s*-\s*\d+\s*munkanap/i) ??
    block.match(/\d+\s*munkanap/i);
  return m?.[0]?.trim() ?? null;
}

export function parseCategoryListingHtml(html: string): OazisListingItem[] {
  const seen = new Set<string>();
  const out: OazisListingItem[] = [];

  let cardM: RegExpExecArray | null;
  PRODUCT_CARD_RE.lastIndex = 0;
  while ((cardM = PRODUCT_CARD_RE.exec(html)) !== null) {
    const block = cardM[1];
    const linkM = block.match(
      /<div class="title">\s*<a href="((?:https:\/\/oaziscomputer\.hu\/)?(?:\/)?termek\/\d+\/[^"]+)"[^>]*>([^<]+)<\/a>/i
    );
    if (!linkM) continue;

    const supplierProductUrl = normalizeOazisProductUrl(absoluteUrl(linkM[1].trim()));
    if (seen.has(supplierProductUrl)) continue;
    seen.add(supplierProductUrl);

    const name = stripHtmlTags(linkM[2]) || "Unknown";

    out.push({
      supplierProductUrl,
      name,
      listPrice: parseOazisBruttoHufPrice(block),
      urlProductId: extractOazisProductIdFromUrl(supplierProductUrl),
      termekkod: extractTermekkodFromListingBlock(block),
      stockLabel: extractAvailabilityFromBlock(block)
    });
  }
  return out;
}

export function parseMaxListingPage(html: string): number {
  let max = 1;
  const re = /kategoria\/\d+\/[^/"'\s?#]+\/(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function extractOazisProductIdFromUrl(url: string): string | null {
  const m = url.match(/(?:^|\/)termek\/(\d+)(?:\/|$|\?)/i);
  return m?.[1]?.trim() || null;
}

export function extractTermekkodFromDetailHtml(html: string): string | null {
  const m =
    html.match(/Termékkód:\s*([^<\s]+)/i) ??
    html.match(/Term&eacute;kk&oacute;d:\s*([^<\s]+)/i) ??
    html.match(/<h2[^>]*>\s*Term[eé]kkód:\s*([^<]+)/i);
  if (!m?.[1]) return null;
  const v = stripHtmlTags(m[1]).replace(/\s+/g, "").trim();
  return v.length > 0 ? v : null;
}

export function parseProductSpecsTable(html: string): SpecRow[] {
  const rows: SpecRow[] = [];
  const tableM =
    html.match(/class="product_attributes"[\s\S]*?<table[\s\S]*?<\/table>/i) ??
    html.match(/<h3[^>]*>\s*Specifikációk[\s\S]*?<table[\s\S]*?<\/table>/i);
  if (!tableM) return rows;
  const re = /<tr[^>]*>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableM[0])) !== null) {
    const name = stripHtmlTags(m[1]);
    const value = stripHtmlTags(m[2]);
    if (!name || !value) continue;
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

function extractAvailabilityFromDetailHtml(html: string): string | null {
  const m =
    html.match(/(Rendelhető,\s*\d+\s*-\s*\d+\s*munkanap)/i) ??
    html.match(/(Rendelhető,\s*\d+\s*munkanap)/i) ??
    html.match(/(\d+\s*-\s*\d+\s*munkanap)/i) ??
    html.match(/(\d+\s*munkanap)/i);
  return m?.[1]?.trim() ?? null;
}

type OazisDetailParsed = {
  termekkod: string | null;
  mpn: string | null;
  price: number | null;
  urlProductId: string | null;
  productName: string | null;
  imageUrl: string | null;
  availabilityLabel: string | null;
  deliveryDays: number;
  warrantyMonths: number | null;
  specRows: SpecRow[];
};

export function parseProductDetailHtml(html: string, productUrl?: string): OazisDetailParsed {
  let productName = extractOgMeta(html, "og:title");
  if (productName) {
    productName = productName.replace(/\s*-\s*OázisComputer\.hu\s*$/i, "").trim();
    productName = productName.replace(/\s*-\s*O&aacute;zisComputer\.hu\s*$/i, "").trim();
  }
  if (!productName) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1?.[1]) productName = stripHtmlTags(h1[1]);
  }

  const imageUrl = extractOgMeta(html, "og:image");
  const termekkod = extractTermekkodFromDetailHtml(html);
  const specRows = parseProductSpecsTable(html);
  const price = parseOazisBruttoHufPrice(html);
  const availabilityLabel = extractAvailabilityFromDetailHtml(html);
  const deliveryDays = parseOazisDeliveryDays(availabilityLabel);
  const warrantyMonths = parseOazisWarrantyMonths(html);
  const mpnRaw = termekkod;
  const mpn = mpnRaw ? normalizeMpn(mpnRaw) : null;

  return {
    termekkod,
    mpn,
    price,
    urlProductId: productUrl ? extractOazisProductIdFromUrl(productUrl) : null,
    productName,
    imageUrl,
    availabilityLabel,
    deliveryDays,
    warrantyMonths,
    specRows
  };
}

export function resolveOazisSupplierProductId(
  detail: OazisDetailParsed,
  listingFallback?: string | null
): string | null {
  const fromDetail = detail.termekkod?.replace(/\s+/g, "").trim();
  if (fromDetail) return fromDetail;
  const fromListing = listingFallback?.replace(/\s+/g, "").trim();
  if (fromListing) return fromListing;
  if (detail.mpn) return detail.mpn;
  if (detail.urlProductId) return detail.urlProductId;
  return null;
}

async function deactivateStaleOazisOffersInCategory(
  supabase: SupabaseClient,
  categoryKey: string,
  fetchedSupplierProductIds: Set<string>
): Promise<number> {
  if (fetchedSupplierProductIds.size === 0) return 0;

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id")
    .eq("supplier_id", OAZIS_SUPPLIER_ID)
    .contains("raw_json", { category: categoryKey });

  if (error) {
    console.warn("[Oázis] stale offers lookup:", error.message);
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
    .eq("supplier_id", OAZIS_SUPPLIER_ID)
    .in("supplier_product_id", staleIds);

  if (uErr) {
    console.warn("[Oázis] stale offers deactivate:", uErr.message);
    return 0;
  }

  return staleIds.length;
}

async function maybeSaveOazisSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  detail: OazisDetailParsed
): Promise<void> {
  try {
    const snapshot: SpecSnapshot = {
      mpn: detail.mpn,
      ean: null,
      factory_link: null,
      specs: detail.specRows
    };
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("supplier_products")
      .update({ spec_snapshot: snapshot, specs_fetched_at: now, updated_at: now })
      .eq("supplier_id", OAZIS_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId)
      .is("spec_snapshot", null);
    if (error) console.warn("[Oázis] spec_snapshot save:", error.message);
  } catch (err) {
    console.warn(
      "[Oázis] spec_snapshot save unexpected:",
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

export type OazisCategoryImportStats = {
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateId: number;
  staleDeactivated: number;
};

export async function importCategory(category: OazisCategory): Promise<OazisCategoryImportStats> {
  const supabase = getSupabase();

  const stats: OazisCategoryImportStats = {
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
    const listHtml = await fetchOazisHtml(listUrl, { kind: "listing" });

    if (page === 1) {
      maxPage = parseMaxListingPage(listHtml);
    }

    const pageItems = parseCategoryListingHtml(listHtml);
    if (isSupplierListingBlocked(listHtml, pageItems.length)) {
      throw new Error("[Oázis] Stopped: bot challenge page detected (category listing).");
    }
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    console.log(
      `[Oázis][page] category=${category.categoryKey} page=${page}/${maxPage} listUrl=${listUrl} pageItems=${pageItems.length} newItems=${newItems.length} seenUrls=${seenUrlsThisCategory.size} remainingSlots=${remainingSlots}`
    );

    if (pageItems.length === 0) {
      console.log(`[Oázis][page-stop] category=${category.categoryKey} page=${page} reason=empty_page_items`);
      break;
    }
    if (newItems.length === 0) {
      console.log(`[Oázis][page-stop] category=${category.categoryKey} page=${page} reason=no_new_items`);
      break;
    }

    for (const item of newItems) {
      if (remainingSlots <= 0) {
        stoppedDueToSlotCap = true;
        break;
      }

      const detailHtml = await fetchOazisHtml(item.supplierProductUrl, {
        kind: "pdp",
        referer: listUrl
      });
      const hasProductSignals =
        hasLikelyProductDetailHtml(detailHtml) || !!extractTermekkodFromDetailHtml(detailHtml);
      if (isSupplierDetailBlocked(detailHtml, hasProductSignals)) {
        throw new Error("[Oázis] Stopped: bot challenge page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml, item.supplierProductUrl);
      const supplierProductId = resolveOazisSupplierProductId(detail, item.termekkod);
      if (!supplierProductId) {
        console.warn("[Oázis] Skip (no Termékkód):", item.supplierProductUrl);
        stats.skippedNoSupplierProductId += 1;
        continue;
      }
      if (seenIdsThisCategory.has(supplierProductId)) {
        console.warn(
          "[Oázis] Skip (duplicate id in category):",
          supplierProductId,
          item.supplierProductUrl
        );
        stats.skippedDuplicateId += 1;
        continue;
      }

      const mpnN = normalizeMpn(detail.mpn ?? supplierProductId);

      const priceAmount =
        detail.price != null && Number.isFinite(detail.price)
          ? detail.price
          : item.listPrice != null
            ? item.listPrice
            : null;

      if (priceAmount == null || !Number.isFinite(priceAmount)) {
        console.warn("[Oázis] Skip (no price):", item.supplierProductUrl);
        stats.skippedNoPrice += 1;
        continue;
      }

      seenIdsThisCategory.add(supplierProductId);

      const match = await resolveSupplierProductMatch(supabase, { ean: null, mpn: mpnN });
      const productId = match.productId;
      let resolvedMpn = mpnN;
      if (productId) {
        const { data: masterIdentifiers, error: masterIdentifiersError } = await supabase
          .from("products")
          .select("mpn, ean")
          .eq("id", productId)
          .maybeSingle();
        if (masterIdentifiersError) {
          throw new Error(`[Oázis] products identifiers lookup: ${masterIdentifiersError.message}`);
        }
        const identifierSync = getIdentifierSyncUpdate(
          { mpn: mpnN, ean: null },
          { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
        );
        resolvedMpn = identifierSync.update.mpn ?? mpnN;
      }

      const rawJson: Record<string, unknown> = {
        source: "oazis",
        category: category.categoryKey,
        listing_name: item.name,
        url: item.supplierProductUrl,
        url_product_id: item.urlProductId ?? detail.urlProductId,
        termekkod: detail.termekkod ?? item.termekkod,
        availability_label: detail.availabilityLabel ?? item.stockLabel,
        matchAudit: match.audit
      };
      if (detail.productName) rawJson.product_name = detail.productName;
      if (detail.imageUrl) rawJson.image_url = detail.imageUrl;

      const row = {
        supplier_id: OAZIS_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
        ean: null,
        delivery_days: detail.deliveryDays,
        warranty_months: detail.warrantyMonths,
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
        throw new Error(`[Oázis] supplier_products upsert: ${upErr.message}`);
      }

      await maybeSaveOazisSpecSnapshot(supabase, supplierProductId, detail);

      stats.upserted += 1;
      remainingSlots -= 1;
      console.log(
        `[Oázis] ${category.categoryKey} — ${item.name.slice(0, 60)}… id=${supplierProductId} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} delivery_days=${detail.deliveryDays} warranty=${detail.warrantyMonths ?? "null"}`
      );
    }

    if (stoppedDueToSlotCap) {
      console.log(`[Oázis][page-stop] category=${category.categoryKey} page=${page} reason=slot_cap_reached`);
      break;
    }

    page += 1;
  }

  if (!stoppedDueToSlotCap) {
    stats.staleDeactivated = await deactivateStaleOazisOffersInCategory(
      supabase,
      category.categoryKey,
      seenIdsThisCategory
    );
  }
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[Oázis] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  return stats;
}

export type OazisImportResult = {
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

export type OazisSupplierCategoryImportInput = {
  listingUrl: string;
  categoryKey?: string;
  name?: string;
};

export function buildOazisCategoryFromSupplierRow(
  input: OazisSupplierCategoryImportInput
): OazisCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za Oázis import ove kategorije.");
  }
  return {
    categoryKey: input.categoryKey ?? input.name ?? "category",
    url
  };
}

export type OazisSingleCategoryImportResult = {
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

export async function runOazisImportForSupplierCategory(
  input: OazisSupplierCategoryImportInput
): Promise<OazisSingleCategoryImportResult> {
  const category = buildOazisCategoryFromSupplierRow(input);
  remainingSlots = Number.MAX_SAFE_INTEGER;
  resetOazisHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  await warmupOazisSession();
  const stats = await importCategory(category);
  const agg = await aggregatePrices();

  console.log("[Oázis import] Jedna kategorija završena.", {
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

export async function runOazisImportProducts(): Promise<OazisImportResult> {
  remainingSlots = getMaxProductsPerRun();
  resetOazisHttpState();
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
    await warmupOazisSession();
    const categories = await resolveOazisCategoriesFromRegistry();
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
      console.warn("[Oázis] aggregate-prices:", agg.error);
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

export { OAZIS_SUPPLIER_ID };
