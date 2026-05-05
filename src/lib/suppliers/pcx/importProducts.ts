/**
 * PCX: HTML listing + detail scrape → `supplier_products` only (no new `products` rows).
 * Run: npx tsx scripts/run-pcx-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { aggregatePrices } from "lib/pricing";
import { createSupabaseServiceClient } from "utils/supabase";
import { PCX_CATEGORIES } from "./categories";

const PCX_SUPPLIER_ID = "f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3";
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
  u.searchParams.set("p", String(page));
  return u.toString();
}

const PCX_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept-Language": "en-US,en;q=0.9"
};

function delayMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function isCaptchaLikeHtml(html: string): boolean {
  const l = html.toLowerCase();
  return l.includes("captcha") || l.includes("verify");
}

let isFirstHttpRequest = true;

async function fetchPcxHtml(url: string): Promise<string> {
  if (!isFirstHttpRequest) {
    await delayMs(3000);
  }
  isFirstHttpRequest = false;

  const res = await fetch(url, { headers: PCX_HEADERS });
  if (!res.ok) {
    throw new Error(`[PCX] HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

type PcxListingItem = {
  supplierProductUrl: string;
  name: string;
  listPrice: number | null;
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
      if (!seen.has(supplierProductUrl)) {
        seen.add(supplierProductUrl);
        const listPrice = parseListPriceFromBlock(block);
        out.push({ supplierProductUrl, name, listPrice });
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
};

function parseProductDetailHtml(html: string): PcxDetailParsed {
  const ld = parseJsonLdProduct(html);
  let mpn: string | null = null;
  let ean: string | null = null;
  let price: number | null = null;

  if (ld) {
    if (typeof ld.mpn === "string" && ld.mpn.trim()) mpn = ld.mpn.trim();
    if (typeof ld.gtin13 === "string" && ld.gtin13.trim()) ean = ld.gtin13.trim();
    if (typeof ld.gtin === "string" && ld.gtin.trim() && !ean) ean = ld.gtin.trim();
    if (typeof ld.gtin14 === "string" && ld.gtin14.trim() && !ean) ean = ld.gtin14.trim();

    const offers = ld.offers as Record<string, unknown> | undefined;
    if (offers && typeof offers === "object") {
      price = numOrNull(offers.price);
    }
  }

  return {
    mpn,
    ean,
    price
  };
}

let remainingSlots = DEFAULT_MAX_PRODUCTS_PER_RUN;
let supabaseSingleton: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseSingleton) supabaseSingleton = createSupabaseServiceClient();
  return supabaseSingleton;
}

/**
 * Import one category until the global per-run cap is reached.
 */
export async function importCategory(category: (typeof PCX_CATEGORIES)[number]): Promise<void> {
  const supabase = getSupabase();

  if (remainingSlots <= 0) return;

  const seenUrlsThisCategory = new Set<string>();
  let page = 1;

  while (remainingSlots > 0 && page <= 200) {
    const listUrl = buildCategoryListUrl(category.url, page);
    const listHtml = await fetchPcxHtml(listUrl);
    if (isCaptchaLikeHtml(listHtml)) {
      throw new Error("[PCX] Stopped: CAPTCHA / verify page detected (category listing).");
    }

    const pageItems = parseCategoryListingHtml(listHtml);
    const newItems = pageItems.filter((i) => !seenUrlsThisCategory.has(i.supplierProductUrl));
    for (const i of newItems) seenUrlsThisCategory.add(i.supplierProductUrl);

    if (pageItems.length === 0) break;
    if (newItems.length === 0) break;

    for (const item of newItems) {
      if (remainingSlots <= 0) break;

      const detailHtml = await fetchPcxHtml(item.supplierProductUrl);
      if (isCaptchaLikeHtml(detailHtml)) {
        throw new Error("[PCX] Stopped: CAPTCHA / verify page detected (product detail).");
      }

      const detail = parseProductDetailHtml(detailHtml);
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
        continue;
      }

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

      const row = {
        supplier_id: PCX_SUPPLIER_ID,
        supplier_product_id: item.supplierProductUrl,
        product_id: productId,
        price_amount: priceAmount,
        currency: "HUF",
        mpn: resolvedMpn,
        ean: resolvedEan,
        enrichment_status: "complete" as const,
        master_match_status: productId ? ("linked" as const) : ("pending_review" as const),
        raw_json: {
          source: "pcx",
          category: category.name,
          listing_name: item.name,
          url: item.supplierProductUrl,
          matchAudit: match.audit
        } as Record<string, unknown>,
        updated_at: new Date().toISOString()
      };

      const { error: upErr } = await supabase.from("supplier_products").upsert(row, {
        onConflict: "supplier_id,supplier_product_id"
      });

      if (upErr) {
        throw new Error(`[PCX] supplier_products upsert: ${upErr.message}`);
      }

      remainingSlots -= 1;
      console.log(
        `[PCX] ${category.name} — ${item.name.slice(0, 60)}… → mpn=${mpnN ?? "(null)"} ean=${eanN ?? "(null)"} product_id=${productId ?? "NULL"} match=${match.audit.method}:${match.audit.result} price=${priceAmount} HUF`
      );
    }

    page += 1;
  }
}

export type PcxImportResult = {
  success: boolean;
  remainingSlots: number;
  error?: string;
};

/**
 * Resets per-run throttle, then imports every category in `PCX_CATEGORIES`
 * until the global cap is reached (env `PCX_MAX_PRODUCTS_PER_RUN`, default 5; `0` = no limit).
 */
export async function runPcxImportProducts(): Promise<PcxImportResult> {
  remainingSlots = getMaxProductsPerRun();
  isFirstHttpRequest = true;
  supabaseSingleton = createSupabaseServiceClient();

  try {
    for (const category of PCX_CATEGORIES) {
      await importCategory(category);
    }
    const agg = await aggregatePrices();
    if (agg.error) {
      console.warn("[PCX] aggregate-prices:", agg.error);
    }
    return { success: true, remainingSlots };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return { success: false, remainingSlots, error: msg };
  }
}
