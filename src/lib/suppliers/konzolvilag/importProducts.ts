/**
 * Konzolvilág: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-konzolvilag-import-products.ts
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
import { KONZOLVILAG_SUPPLIER_ID } from "./constants";
import { KONZOLVILAG_CATEGORIES, type KonzolvilagCategory } from "./categories";
import {
  extractHazhozSzallitasStatusFromDetailHtml,
  extractListingStockLabel,
  parseKonzolvilagDeliveryDays
} from "./delivery-days";

const BASE_ORIGIN = "https://www.konzolvilag.hu";

/** Default cap per run. `KONZOLVILAG_MAX_PRODUCTS_PER_RUN=0` = no limit. */
const DEFAULT_MAX_PRODUCTS_PER_RUN = 5;

function getMaxProductsPerRun(): number {
  const raw = process.env.KONZOLVILAG_MAX_PRODUCTS_PER_RUN;
  if (raw === undefined || raw === "") return DEFAULT_MAX_PRODUCTS_PER_RUN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_PRODUCTS_PER_RUN;
  if (n === 0) return Number.MAX_SAFE_INTEGER;
  return n;
}

async function resolveKonzolvilagCategoriesFromRegistry(): Promise<KonzolvilagCategory[]> {
  const rows = await getSupplierCategories(KONZOLVILAG_SUPPLIER_ID);
  if (rows.length === 0) return KONZOLVILAG_CATEGORIES;
  const out: KonzolvilagCategory[] = [];
  for (const row of rows) {
    if (!row.listingUrl) continue;
    const fallback = KONZOLVILAG_CATEGORIES.find((c) => c.url === row.listingUrl);
    out.push({
      categoryKey: row.supplierCategoryKey ?? fallback?.categoryKey ?? "category",
      url: row.listingUrl
    });
  }
  return out.length > 0 ? out : KONZOLVILAG_CATEGORIES;
}

/** Path pagination: `/oldal-2` — page 1 is base URL without suffix. */
export function buildCategoryListUrl(categoryUrl: string, page: number): string {
  const base = categoryUrl.replace(/\/oldal-\d+\/?$/, "");
  if (page <= 1) return base;
  return `${base}/oldal-${page}`;
}

const KONZOLVILAG_USER_AGENT =
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

type KonzolvilagFetchKind = "homepage" | "listing" | "pdp";

function buildKonzolvilagHeaders(kind: KonzolvilagFetchKind, referer: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": KONZOLVILAG_USER_AGENT,
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

type KonzolvilagFetchOptions = {
  kind?: KonzolvilagFetchKind;
  referer?: string | null;
  skipDelay?: boolean;
};

let isFirstHttpRequest = true;
let lastKonzolvilagUrl: string | null = null;

async function fetchKonzolvilagHtml(
  url: string,
  options: KonzolvilagFetchOptions = {}
): Promise<string> {
  const kind: KonzolvilagFetchKind = options.kind ?? "pdp";
  const referer = options.referer === undefined ? lastKonzolvilagUrl : options.referer;

  if (!isFirstHttpRequest && !options.skipDelay) {
    await delayMs(jitteredDelayMs());
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, {
    headers: buildKonzolvilagHeaders(kind, referer),
    signal: AbortSignal.timeout(120_000)
  });
  ingestSetCookies(res);

  if (!res.ok) {
    throw new Error(`[Konzolvilág] HTTP ${res.status} for ${url}`);
  }
  lastKonzolvilagUrl = url;
  return res.text();
}

function resetKonzolvilagHttpState(): void {
  cookieJar.clear();
  isFirstHttpRequest = true;
  lastKonzolvilagUrl = null;
}

async function warmupKonzolvilagSession(): Promise<void> {
  const homepageHtml = await fetchKonzolvilagHtml(`${BASE_ORIGIN}/`, {
    kind: "homepage",
    referer: null,
    skipDelay: true
  });
  if (isSupplierWarmupBlocked(homepageHtml)) {
    throw new Error("[Konzolvilág] Stopped: bot challenge page detected (homepage warmup).");
  }
  console.log(`[Konzolvilág][warmup] homepage OK, cookies=${cookieJar.size}`);
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${BASE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function normalizeKonzolvilagProductUrl(url: string): string {
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

/** Current brutto HUF — sale price when `price-data` / `div.now` present. */
export function parseKonzolvilagBruttoHufPrice(text: string): number | null {
  const metaM = text.match(/itemprop=["']price["'][^>]+content=["'](\d+)["']/i);
  if (metaM) {
    const n = Number(metaM[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const dataM = text.match(/class="price-data"[^>]+value=["'](\d+)["']/i);
  if (dataM) {
    const n = Number(dataM[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const nowM = text.match(/<div class="now">([\d\s]+)\s*<span>Ft<\/span>/i);
  if (nowM) {
    const n = Number(nowM[1].replace(/\s/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }

  const prices: number[] = [];
  const re = /(\d[\d\s]+)\s*<span>Ft<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/\s/g, ""));
    if (Number.isFinite(n) && n > 1000) prices.push(n);
  }
  if (prices.length > 0) return Math.min(...prices);

  return null;
}

export type KonzolvilagListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
  listInstanceId: string | null;
  gyartoCikkszam: string | null;
  stockLabel: string | null;
};

/** Outer product `<li>` closes with `<!-- carousel-item -->` (inner tick-list has nested `<li>`). */
const LISTING_ITEM_RE =
  /<li id="(\d+)">([\s\S]*?)<\/li>\s*<!--\s*carousel-item\s*-->/gi;

function extractGyartoCikkszamFromTitle(name: string): string | null {
  const m = name.match(/\(([^)]+)\)\s*$/);
  const raw = m?.[1]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function parseCategoryListingHtml(html: string): KonzolvilagListingItem[] {
  const seen = new Set<string>();
  const out: KonzolvilagListingItem[] = [];

  let m: RegExpExecArray | null;
  LISTING_ITEM_RE.lastIndex = 0;
  while ((m = LISTING_ITEM_RE.exec(html)) !== null) {
    const block = m[2];
    const linkM = block.match(
      /<h3[^>]*class="[^"]*product-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)</i
    );
    if (!linkM) continue;

    const supplierProductUrl = normalizeKonzolvilagProductUrl(absoluteUrl(linkM[1].trim()));
    if (!supplierProductUrl.includes("/pc/")) continue;
    if (seen.has(supplierProductUrl)) continue;
    seen.add(supplierProductUrl);

    const name = stripHtmlTags(linkM[3] || linkM[2] || "") || "Unknown";

    out.push({
      supplierProductUrl,
      name,
      listPrice: parseKonzolvilagBruttoHufPrice(block),
      listInstanceId: m[1]?.trim() ?? null,
      gyartoCikkszam: extractGyartoCikkszamFromTitle(name),
      stockLabel: extractListingStockLabel(block)
    });
  }
  return out;
}

export function parseMaxListingPage(html: string, currentPage = 1): number {
  let max = currentPage;
  const re = /more-link[^>]+href=["'][^"']*\/oldal-(\d+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

function extractIconListValue(html: string, label: string): string | null {
  const re = new RegExp(
    `${label}[\\s\\S]{0,400}?<div class="right"[^>]*>\\s*<span[^>]*>([^<]+)<`,
    "i"
  );
  const m = html.match(re);
  if (!m?.[1]) return null;
  const v = stripHtmlTags(m[1]).trim();
  return v.length > 0 ? v : null;
}

export function extractTermekAzonositoFromDetailHtml(html: string): string | null {
  const v =
    extractIconListValue(html, "Termékazonosító") ??
    extractIconListValue(html, "Term&eacute;kazonos&iacute;t&oacute;");
  return v?.replace(/\s+/g, "").trim() || null;
}

export function extractGyartoCikkszamFromDetailHtml(html: string): string | null {
  const v =
    extractIconListValue(html, "Gyártói cikkszám") ??
    extractIconListValue(html, "Gy&aacute;rt&oacute;i cikksz&aacute;m");
  return v?.replace(/\s+/g, "").trim() || null;
}

export function parseProductSpecsTable(html: string): SpecRow[] {
  const rows: SpecRow[] = [];
  const sectionM = html.match(/specifikáció[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div class="remodal)/i);
  if (!sectionM) return rows;

  const re = /<tr>\s*<th>([^<]*)<\/th>\s*<td>([^<]*)<\/td>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sectionM[1])) !== null) {
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

type KonzolvilagDetailParsed = {
  termekAzonosito: string | null;
  mpn: string | null;
  price: number | null;
  productName: string | null;
  imageUrl: string | null;
  availabilityLabel: string | null;
  deliveryDays: number;
  specRows: SpecRow[];
};

export function parseProductDetailHtml(
  html: string,
  productUrl?: string,
  listingFallback?: { stockLabel?: string | null; gyartoCikkszam?: string | null }
): KonzolvilagDetailParsed {
  let productName = extractOgMeta(html, "og:title");
  if (productName) {
    productName = productName.replace(/\s*-\s*pc\s*-\s*Konzolvilág\s*$/i, "").trim();
    productName = productName.replace(/\s*-\s*Konzolvilág\s*$/i, "").trim();
  }
  if (!productName) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1?.[1]) productName = stripHtmlTags(h1[1]);
  }

  const imageUrl = extractOgMeta(html, "og:image");
  const termekAzonosito = extractTermekAzonositoFromDetailHtml(html);
  const gyartoRaw = extractGyartoCikkszamFromDetailHtml(html) ?? listingFallback?.gyartoCikkszam;
  const mpn = gyartoRaw ? normalizeMpn(gyartoRaw) : null;
  const specRows = parseProductSpecsTable(html);
  const price = parseKonzolvilagBruttoHufPrice(html);

  const hazhoz = extractHazhozSzallitasStatusFromDetailHtml(html);
  const availMeta = html.match(/itemprop=["']availability["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const availabilityLabel = hazhoz ?? listingFallback?.stockLabel ?? availMeta ?? null;
  const deliveryDays = parseKonzolvilagDeliveryDays(availabilityLabel);

  return {
    termekAzonosito,
    mpn,
    price,
    productName,
    imageUrl,
    availabilityLabel,
    deliveryDays,
    specRows
  };
}

export function resolveKonzolvilagSupplierProductId(detail: KonzolvilagDetailParsed): string | null {
  const fromDetail = detail.termekAzonosito?.replace(/\s+/g, "").trim();
  if (fromDetail) return fromDetail;
  return null;
}

async function deactivateStaleKonzolvilagOffersInCategory(
  supabase: SupabaseClient,
  categoryKey: string,
  fetchedSupplierProductIds: Set<string>
): Promise<number> {
  if (fetchedSupplierProductIds.size === 0) return 0;

  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id")
    .eq("supplier_id", KONZOLVILAG_SUPPLIER_ID)
    .contains("raw_json", { category: categoryKey });

  if (error) {
    console.warn("[Konzolvilág] stale offers lookup:", error.message);
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
    .eq("supplier_id", KONZOLVILAG_SUPPLIER_ID)
    .in("supplier_product_id", staleIds);

  if (uErr) {
    console.warn("[Konzolvilág] stale offers deactivate:", uErr.message);
    return 0;
  }

  return staleIds.length;
}

async function maybeSaveKonzolvilagSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  detail: KonzolvilagDetailParsed
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
      .eq("supplier_id", KONZOLVILAG_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId)
      .is("spec_snapshot", null);
    if (error) console.warn("[Konzolvilág] spec_snapshot save:", error.message);
  } catch (err) {
    console.warn(
      "[Konzolvilág] spec_snapshot save unexpected:",
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

export type KonzolvilagCategoryImportStats = {
  upserted: number;
  skippedNoPrice: number;
  skippedNoSupplierProductId: number;
  skippedDuplicateId: number;
  staleDeactivated: number;
};

export async function importCategory(
  category: KonzolvilagCategory
): Promise<KonzolvilagCategoryImportStats> {
  const supabase = getSupabase();

  const stats: KonzolvilagCategoryImportStats = {
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
  let maxPage = 1;

  while (remainingSlots > 0 && page <= maxPage) {
    const listUrl = buildCategoryListUrl(category.url, page);
    const listHtml = await fetchKonzolvilagHtml(listUrl, { kind: "listing" });

    maxPage = Math.max(maxPage, parseMaxListingPage(listHtml, page));

    const pageItems = parseCategoryListingHtml(listHtml);
    if (isSupplierListingBlocked(listHtml, pageItems.length)) {
      throw new Error("[Konzolvilág] Stopped: bot challenge page detected (category listing).");
    }
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    console.log(
      `[Konzolvilág][page] category=${category.categoryKey} page=${page}/${maxPage} listUrl=${listUrl} pageItems=${pageItems.length} newItems=${newItems.length} seenUrls=${seenUrlsThisCategory.size} remainingSlots=${remainingSlots}`
    );

    if (pageItems.length === 0) {
      console.log(
        `[Konzolvilág][page-stop] category=${category.categoryKey} page=${page} reason=empty_page_items`
      );
      break;
    }
    if (newItems.length === 0) {
      console.log(
        `[Konzolvilág][page-stop] category=${category.categoryKey} page=${page} reason=no_new_items`
      );
      break;
    }

    for (const item of newItems) {
      if (remainingSlots <= 0) {
        stoppedDueToSlotCap = true;
        break;
      }

      const detailHtml = await fetchKonzolvilagHtml(item.supplierProductUrl, {
        kind: "pdp",
        referer: listUrl
      });
      const hasProductSignals =
        hasLikelyProductDetailHtml(detailHtml) ||
        !!extractTermekAzonositoFromDetailHtml(detailHtml);
      if (isSupplierDetailBlocked(detailHtml, hasProductSignals)) {
        throw new Error("[Konzolvilág] Stopped: bot challenge page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml, item.supplierProductUrl, {
        stockLabel: item.stockLabel,
        gyartoCikkszam: item.gyartoCikkszam
      });
      const supplierProductId = resolveKonzolvilagSupplierProductId(detail);
      if (!supplierProductId) {
        console.warn("[Konzolvilág] Skip (no Termékazonosító):", item.supplierProductUrl);
        stats.skippedNoSupplierProductId += 1;
        continue;
      }
      if (seenIdsThisCategory.has(supplierProductId)) {
        console.warn(
          "[Konzolvilág] Skip (duplicate id in category):",
          supplierProductId,
          item.supplierProductUrl
        );
        stats.skippedDuplicateId += 1;
        continue;
      }

      const mpnN = normalizeMpn(detail.mpn ?? item.gyartoCikkszam);

      const priceAmount =
        detail.price != null && Number.isFinite(detail.price)
          ? detail.price
          : item.listPrice != null
            ? item.listPrice
            : null;

      if (priceAmount == null || !Number.isFinite(priceAmount)) {
        console.warn("[Konzolvilág] Skip (no price):", item.supplierProductUrl);
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
          throw new Error(
            `[Konzolvilág] products identifiers lookup: ${masterIdentifiersError.message}`
          );
        }
        const identifierSync = getIdentifierSyncUpdate(
          { mpn: mpnN, ean: null },
          { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
        );
        resolvedMpn = identifierSync.update.mpn ?? mpnN;
      }

      const rawJson: Record<string, unknown> = {
        source: "konzolvilag",
        category: category.categoryKey,
        listing_name: item.name,
        url: item.supplierProductUrl,
        list_instance_id: item.listInstanceId,
        termek_azonosito: detail.termekAzonosito ?? supplierProductId,
        gyarto_cikkszam: detail.mpn ?? item.gyartoCikkszam,
        availability_label: detail.availabilityLabel ?? item.stockLabel,
        matchAudit: match.audit
      };
      if (detail.productName) rawJson.product_name = detail.productName;
      if (detail.imageUrl) rawJson.image_url = detail.imageUrl;

      const row = {
        supplier_id: KONZOLVILAG_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
        ean: null,
        delivery_days: detail.deliveryDays,
        warranty_months: null,
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
        throw new Error(`[Konzolvilág] supplier_products upsert: ${upErr.message}`);
      }

      await maybeSaveKonzolvilagSpecSnapshot(supabase, supplierProductId, detail);

      stats.upserted += 1;
      remainingSlots -= 1;
      console.log(
        `[Konzolvilág] ${category.categoryKey} — ${item.name.slice(0, 60)}… id=${supplierProductId} mpn=${mpnN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} delivery_days=${detail.deliveryDays}`
      );
    }

    if (stoppedDueToSlotCap) {
      console.log(
        `[Konzolvilág][page-stop] category=${category.categoryKey} page=${page} reason=slot_cap_reached`
      );
      break;
    }

    page += 1;
  }

  if (!stoppedDueToSlotCap) {
    stats.staleDeactivated = await deactivateStaleKonzolvilagOffersInCategory(
      supabase,
      category.categoryKey,
      seenIdsThisCategory
    );
  }
  const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
  if (rec.error) {
    console.warn("[Konzolvilág] reconcile_products_is_active_from_supplier_offers:", rec.error);
  }

  return stats;
}

export type KonzolvilagImportResult = {
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

export type KonzolvilagSupplierCategoryImportInput = {
  listingUrl: string;
  categoryKey?: string;
  name?: string;
};

export function buildKonzolvilagCategoryFromSupplierRow(
  input: KonzolvilagSupplierCategoryImportInput
): KonzolvilagCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za Konzolvilág import ove kategorije.");
  }
  return {
    categoryKey: input.categoryKey ?? input.name ?? "category",
    url
  };
}

export type KonzolvilagSingleCategoryImportResult = {
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

export async function runKonzolvilagImportForSupplierCategory(
  input: KonzolvilagSupplierCategoryImportInput
): Promise<KonzolvilagSingleCategoryImportResult> {
  const category = buildKonzolvilagCategoryFromSupplierRow(input);
  remainingSlots = Number.MAX_SAFE_INTEGER;
  resetKonzolvilagHttpState();
  supabaseSingleton = createSupabaseServiceClient();

  await warmupKonzolvilagSession();
  const stats = await importCategory(category);
  const agg = await aggregatePrices();

  console.log("[Konzolvilág import] Jedna kategorija završena.", {
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

export async function runKonzolvilagImportProducts(): Promise<KonzolvilagImportResult> {
  remainingSlots = getMaxProductsPerRun();
  resetKonzolvilagHttpState();
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
    await warmupKonzolvilagSession();
    const categories = await resolveKonzolvilagCategoriesFromRegistry();
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
      console.warn("[Konzolvilág] aggregate-prices:", agg.error);
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

export { KONZOLVILAG_SUPPLIER_ID };
