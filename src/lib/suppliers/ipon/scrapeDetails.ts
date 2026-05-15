/**
 * iPon: JSON-LD detalji (MPN, EAN, specifikacije, factory_link) — odvojeno od API importa.
 * Run: npx tsx scripts/run-ipon-scrape-details.ts
 *
 * Idempotencija: ako supplier_products.spec_snapshot IS NOT NULL → preskoči HTTP.
 * Dodavanje novog atributa u kategoriju ne zahtijeva re-scrape — samo re-run enrichment job-a.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEan, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { createSupabaseServiceClient } from "utils/supabase";
import { fetchWithSession } from "lib/suppliers/shared/http-session";
import { buildAttributeSlugResolver, loadAttributeMappings } from "lib/suppliers/registry";
import { IPON_SUPPLIER_ID, getDefaultIponListingUrl, getIponListingUrlByInternalCategoryId } from "./categories";
import {
  IPON_ACCEPT_LANGUAGE,
  IPON_IMPORT_USER_AGENT,
  createIponCookieJar,
  getIponOrigin,
  numEnv as iponNumEnv,
  sleep,
  warmupIponSessionForListing
} from "./ipon-fetch";
import type { IponProductItem } from "./transformProduct";
import { getIponProductDetailUrl } from "./transformProduct";
import { getRandomReferer, randomDelay } from "./scrape-config";
import { withPostgrestTransientRetry } from "./transient-retry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import { collectAdditionalProperty as _collectAdditionalProperty } from "lib/suppliers/shared/spec-snapshot";

type ParsedIponJsonLd = {
  mpn: string | null;
  ean: string | null;
  factory_link: string | null;
  specRows: SpecRow[];
  productEntityCount: number;
  rawProductJsonLd?: Record<string, unknown>[];
};

type QueueRow = {
  id: string;
  category_id: string | null;
  supplier_products: {
    supplier_product_id: string;
    raw_json: unknown;
    spec_snapshot: unknown;
  }[];
};

// ---------------------------------------------------------------------------
// HTTP config
// ---------------------------------------------------------------------------

const SCRAPE_PRODUCT_HEADERS = {
  userAgent: IPON_IMPORT_USER_AGENT,
  acceptOverride: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  acceptLanguage: IPON_ACCEPT_LANGUAGE
} as const;

const CAPTCHA_SLEEP_MS = iponNumEnv("IPON_SCRAPE_CAPTCHA_SLEEP_MS", 0);
const BATCH_GAP_MS = iponNumEnv("IPON_SCRAPE_BATCH_GAP_MS", 3000);

function isMotherboardCategory(categoryId: string | null | undefined): boolean {
  // category id resolved at runtime from DB — no hardcoded constant needed
  // keep heuristic for batch sizing only; enrichment config comes from DB
  return false; // override via IPON_SCRAPE_BATCH_SIZE env if needed
}

function scrapeBatchSize(): number {
  const max = iponNumEnv("IPON_SCRAPE_BATCH_SIZE_MAX", 10);
  return Math.min(max, Math.max(1, iponNumEnv("IPON_SCRAPE_BATCH_SIZE", 8)));
}

function productDelayMs(categoryId: string | null | undefined): number {
  void categoryId;
  const min = iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_MIN_MS", 4000);
  const jitter = iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_JITTER_MS", 2000);
  return randomDelay(min, jitter);
}

function maxDetailRequestsForRun(batchSize: number): number {
  return Math.max(0, iponNumEnv("IPON_SCRAPE_MAX_DETAIL_REQUESTS", batchSize));
}

// ---------------------------------------------------------------------------
// JSON-LD parsing
// ---------------------------------------------------------------------------

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* skip malformed blocks */
    }
  }
  return out;
}

function expandGraphRoots(blocks: unknown[]): unknown[] {
  const expanded: unknown[] = [];
  for (const b of blocks) {
    expanded.push(b);
    if (b && typeof b === "object" && !Array.isArray(b)) {
      const g = (b as Record<string, unknown>)["@graph"];
      if (Array.isArray(g)) {
        for (const x of g) expanded.push(x);
      }
    }
  }
  return expanded;
}

function schemaTypeIsProduct(typeVal: unknown): boolean {
  if (typeVal === "Product") return true;
  if (Array.isArray(typeVal)) return typeVal.some((x) => schemaTypeIsProduct(x));
  if (typeof typeVal === "string") {
    const s = typeVal.trim();
    if (s === "Product") return true;
    const lower = s.toLowerCase();
    if (lower === "https://schema.org/product" || lower === "http://schema.org/product") return true;
    if (/\/Product$/i.test(s)) return true;
  }
  return false;
}

function isProductLike(o: Record<string, unknown>): boolean {
  return schemaTypeIsProduct(o["@type"]);
}

export function collectAdditionalProperty(node: Record<string, unknown>, acc: SpecRow[]): void {
  _collectAdditionalProperty(node, acc);
}

function isUnwantedProductUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("ipon.hu") || u.includes("iponcomp.com")) return true;
  if (u.includes("icdn.hu") || u.includes("facebook.com") || u.includes("schema.org")) return true;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return true;
  return false;
}

function looksLikeManufacturerSite(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("ark.intel.com") ||
    u.includes("intel.com/content/www") ||
    u.includes("intel.com/products") ||
    u.includes("amd.com") ||
    u.includes("nvidia.com") ||
    u.includes("asus.com") ||
    u.includes("msi.com") ||
    u.includes("gigabyte.com") ||
    u.includes("supermicro.com") ||
    u.includes("samsung.com") ||
    u.includes("crucial.com") ||
    u.includes("kingston.com") ||
    u.includes("wd.com") ||
    u.includes("seagate.com")
  );
}

function decodeHtmlEntitiesInUrl(url: string): string {
  return url
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"');
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * iPon often puts the real manufacturer URL only in the spec table as
 * <a href="https://ark.intel.com/...">Factory link</a> (EN) or "Gyári link" (HU),
 * not in JSON-LD sameAs.
 */
function extractFactoryLinkFromHtml(html: string): string | null {
  const linkLabel = /factory\s*link|gy[aá]ri\s*link|manufacturer\s*page|gy[aá]rt[oó]i?\s*oldal/i;

  // 1) <a href="..."> ... Factory link ... </a> (tolerates nested tags / Alpine noise inside)
  const anchorRe = /<a\b[^>]*?\bhref\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = decodeHtmlEntitiesInUrl(m[1].trim());
    const innerText = stripHtmlTags(m[2]);
    if (!href || isUnwantedProductUrl(href)) continue;
    if (linkLabel.test(innerText)) return href;
  }

  // 2) Text "Factory link" then nearest preceding href= in a window (messy DOM / minified HTML)
  const textNeedle = /factory\s*link|gy[aá]ri\s*link/gi;
  let t: RegExpExecArray | null;
  while ((t = textNeedle.exec(html)) !== null) {
    const pos = t.index;
    const before = html.slice(Math.max(0, pos - 6000), pos);
    const hrefs = Array.from(before.matchAll(/href\s*=\s*["'](https?:\/\/[^"'>\s]+)["']/gi));
    for (let i = hrefs.length - 1; i >= 0; i--) {
      const href = decodeHtmlEntitiesInUrl(hrefs[i][1].trim());
      if (href && !isUnwantedProductUrl(href) && looksLikeManufacturerSite(href)) return href;
    }
    for (let i = hrefs.length - 1; i >= 0; i--) {
      const href = decodeHtmlEntitiesInUrl(hrefs[i][1].trim());
      if (href && !isUnwantedProductUrl(href)) return href;
    }
  }

  // 3) JSON embedded in page (Alpine / product bootstrap) — manufacturer URL only
  const jsonUrlMatch = html.match(
    /"(?:factoryLink|factory_link|manufacturerUrl|manufacturer_url|productUrl|officialUrl)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i
  );
  if (jsonUrlMatch) {
    const raw = jsonUrlMatch[1].replace(/\\\//g, "/");
    const href = decodeHtmlEntitiesInUrl(raw);
    if (href && !isUnwantedProductUrl(href)) return href;
  }

  // 4) Last resort: first Intel ARK product href (CPU pages almost always have exactly one)
  const ark = html.match(
    /href\s*=\s*["'](https?:\/\/ark\.intel\.com\/content\/www\/[^"']+\/products\/[^"']+)["']/i
  );
  if (ark) {
    const href = decodeHtmlEntitiesInUrl(ark[1].trim());
    if (href && !isUnwantedProductUrl(href)) return href;
  }

  return null;
}

function extractFactoryLink(node: Record<string, unknown>): string | null {
  const sameAs = node.sameAs;
  const candidates: string[] = [];
  if (typeof sameAs === "string" && sameAs.trim()) candidates.push(sameAs.trim());
  if (Array.isArray(sameAs)) {
    for (const s of sameAs) {
      if (typeof s === "string" && s.trim()) candidates.push(s.trim());
    }
  }
  for (const c of candidates) {
    if (!isUnwantedProductUrl(c) && looksLikeManufacturerSite(c)) return c;
  }
  for (const c of candidates) {
    if (!isUnwantedProductUrl(c)) return c;
  }
  const url = node.url;
  if (typeof url === "string" && url.trim() && !isUnwantedProductUrl(url)) return url.trim();
  return null;
}

function walkForProduct(node: unknown, products: Record<string, unknown>[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const x of node) walkForProduct(x, products);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (isProductLike(o)) products.push(o);
  for (const v of Object.values(o)) walkForProduct(v, products);
}

function parseIponProductJsonLdFromHtml(html: string): ParsedIponJsonLd {
  const roots = expandGraphRoots(extractJsonLdBlocks(html));
  const products: Record<string, unknown>[] = [];
  for (const b of roots) walkForProduct(b, products);

  let mpn: string | null = null;
  let ean: string | null = null;
  let factory_link: string | null = null;
  const specRows: SpecRow[] = [];

  for (const p of products) {
    if (typeof p.mpn === "string" && p.mpn.trim()) mpn = p.mpn.trim();
    if (typeof p.gtin13 === "string" && p.gtin13.trim()) ean = p.gtin13.trim();
    if (typeof p.gtin === "string" && p.gtin.trim() && !ean) ean = p.gtin.trim();
    if (typeof p.gtin14 === "string" && p.gtin14.trim() && !ean) ean = p.gtin14.trim();
    if (!factory_link) factory_link = extractFactoryLink(p);
    collectAdditionalProperty(p, specRows);
  }

  if (!factory_link) factory_link = extractFactoryLinkFromHtml(html);

  return {
    mpn,
    ean,
    factory_link,
    specRows,
    productEntityCount: products.length,
    rawProductJsonLd: products
  };
}

function assignFirstIdentifier(
  target: { mpn: string | null; ean: string | null },
  node: Record<string, unknown>
): void {
  const mpn = node.mpn ?? node.manufacturerPartNumber ?? node.partNumber;
  if (!target.mpn && typeof mpn === "string" && mpn.trim()) target.mpn = mpn.trim();

  const ean = node.ean ?? node.gtin13 ?? node.gtin ?? node.gtin14 ?? node.barcode;
  if (!target.ean && typeof ean === "string" && ean.trim()) target.ean = ean.trim();
  if (!target.ean && typeof ean === "number" && Number.isFinite(ean)) target.ean = String(ean);
}

function walkRawProductData(node: unknown, parsed: ParsedIponJsonLd): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const x of node) walkRawProductData(x, parsed);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  assignFirstIdentifier(parsed, o);
  collectAdditionalProperty(o, parsed.specRows);
  for (const v of Object.values(o)) walkRawProductData(v, parsed);
}

function parseIponProductDetailsFromRawJson(raw: unknown): ParsedIponJsonLd {
  const parsed: ParsedIponJsonLd = {
    mpn: null,
    ean: null,
    factory_link: null,
    specRows: [],
    productEntityCount: 0
  };
  walkRawProductData(raw, parsed);
  if (parsed.mpn || parsed.ean || parsed.specRows.length > 0) parsed.productEntityCount = 1;
  return parsed;
}

// ---------------------------------------------------------------------------
// Fallback hardcoded mapper (used only if DB has no mappings for supplier)
// ---------------------------------------------------------------------------

function normSpec(s: string): string {
  return s.trim().toLowerCase();
}

export function mapSpecNameToSlug(name: string): string | null {
  const n = normSpec(name);
  if (n.includes("integrated") && n.includes("vga")) return null;
  if (n === "boxed" || n.includes("boxed")) return "boxed";
  if (n.includes("cpu family") || n.includes("cpu-family")) return "cpu_family";
  if (n.includes("socket")) return "socket";
  if (n.includes("tdp")) return "tdp";
  if (n.includes("clock") && n.includes("speed")) return "clock_speed";
  if (n.includes("turbo") || n.includes("max. frequency") || n.includes("max frequency"))
    return "turbo_frequency";
  if (n.includes("chipset")) return "chipset";
  if (n.includes("memory") && (n.includes("type") || n.includes("standard"))) return "memory_type";
  if (
    n.includes("memory") &&
    (n.includes("socket") || n.includes("slot") || n.includes("sockets") || n.includes("slots"))
  )
    return "memory_sockets";
  if (
    n.includes("m.2") ||
    n.includes("m2") ||
    (n.includes("m-key") && n.includes("connector"))
  )
    return "m2_connectors";
  return null;
}

function splitIntegratedVga(props: SpecRow[]): { vga: string | null; chip: string | null } {
  const vgas = props.filter((p) => normSpec(p.name).includes("integrated") && normSpec(p.name).includes("vga"));
  if (vgas.length === 0) return { vga: null, chip: null };
  if (vgas.length === 1) {
    const v = vgas[0].value.trim();
    if (/^(yes|no|igen|nem|da|ne)$/i.test(v)) return { vga: v, chip: null };
    return { vga: null, chip: v };
  }
  return { vga: vgas[0].value.trim(), chip: vgas[1].value.trim() };
}

// ---------------------------------------------------------------------------
// spec_snapshot persistence
// ---------------------------------------------------------------------------

/**
 * Idempotentno upisuje spec_snapshot u supplier_products i postavlja specs_fetched_at.
 * Poziva se jednom — ako je spec_snapshot već NOT NULL, red je preskočen u queue-u.
 */
async function saveSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  parsed: ParsedIponJsonLd
): Promise<void> {
  try {
    // Enhance specRows with integrated_vga split
    const { vga, chip } = splitIntegratedVga(parsed.specRows);
    const extraSpecs: SpecRow[] = [];
    if (vga) extraSpecs.push({ name: "Integrated VGA", value: vga });
    if (chip) extraSpecs.push({ name: "Integrated VGA chip", value: chip });

    const snapshot: SpecSnapshot = {
      mpn: parsed.mpn,
      ean: parsed.ean,
      factory_link: parsed.factory_link,
      specs: [
        ...parsed.specRows.filter(
          (r) => !normSpec(r.name).includes("integrated") || !normSpec(r.name).includes("vga")
        ),
        ...extraSpecs
      ]
    };

    const now = new Date().toISOString();
    const { error } = await withPostgrestTransientRetry(
      "supplier_products.spec-snapshot-save",
      async () =>
        await supabase
          .from("supplier_products")
          .update({
            spec_snapshot: snapshot,
            specs_fetched_at: now,
            enrichment_status: "complete",
            updated_at: now
          })
          .eq("supplier_id", IPON_SUPPLIER_ID)
          .eq("supplier_product_id", supplierProductId)
    );
    if (error) {
      console.warn("[iPon] saveSpecSnapshot update failed:", error.message);
    }
  } catch (err) {
    console.warn("[iPon] saveSpecSnapshot unexpected error:", err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// MPN / EAN sync to products + supplier_products
// ---------------------------------------------------------------------------

async function syncIdentifiers(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  mpnN: string | null,
  eanN: string | null,
  dryRun: boolean
): Promise<void> {
  if (!mpnN && !eanN) return;

  const { data: currentProduct } = await withPostgrestTransientRetry(
    "products.current-identifiers",
    async () => await supabase.from("products").select("mpn, ean").eq("id", productId).maybeSingle()
  );

  const { data: currentSp } = await withPostgrestTransientRetry(
    "supplier_products.current-identifiers",
    async () =>
      await supabase
        .from("supplier_products")
        .select("mpn, ean")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
        .maybeSingle()
  );

  const prodUpdate: Record<string, string> = {};
  if (mpnN && !normalizeMpn(currentProduct?.mpn)) prodUpdate.mpn = mpnN;
  if (eanN && !normalizeEan(currentProduct?.ean)) prodUpdate.ean = eanN;

  const spUpdate: Record<string, string> = {};
  if (mpnN && !normalizeMpn(currentSp?.mpn)) spUpdate.mpn = mpnN;
  if (eanN && !normalizeEan(currentSp?.ean)) spUpdate.ean = eanN;

  if (dryRun) {
    if (Object.keys(prodUpdate).length > 0)
      console.log(`[iPon][dry-run] products.${productId}: would write identifiers`, prodUpdate);
    if (Object.keys(spUpdate).length > 0)
      console.log(`[iPon][dry-run] supplier_products.${supplierProductId}: would write identifiers`, spUpdate);
    return;
  }

  if (Object.keys(prodUpdate).length > 0) {
    const { error } = await supabase
      .from("products")
      .update({ ...prodUpdate, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) console.error("[iPon] products identifier update:", error.message);
  }

  if (Object.keys(spUpdate).length > 0) {
    const { error } = await supabase
      .from("supplier_products")
      .update({ ...spUpdate, updated_at: new Date().toISOString() })
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId);
    if (error) console.error("[iPon] supplier_products identifier update:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/**
 * Red: iPon artikli kojima fali spec_snapshot (nije još scrapeovano).
 * Idempotencija: spec_snapshot IS NOT NULL → izostavi iz reda.
 * Kompletnost atributa provjerava enrichment job — ovdje se NE provjerava.
 */
async function fetchIponScrapeQueueBatch(
  supabase: SupabaseClient,
  categoryId: string | undefined,
  batchSize: number
): Promise<QueueRow[]> {
  const sel = `
    id,
    category_id,
    supplier_products!inner (
      supplier_id,
      supplier_product_id,
      raw_json,
      spec_snapshot
    )
  `;

  const scanPageSize = Math.max(batchSize * 20, 50);
  const maxScan = iponNumEnv("IPON_SCRAPE_QUEUE_SCAN_LIMIT", 500);
  const out: QueueRow[] = [];
  let offset = 0;

  while (out.length < batchSize && offset < maxScan) {
    let q = supabase
      .from("products")
      .select(sel)
      .eq("supplier_products.supplier_id", IPON_SUPPLIER_ID)
      .is("supplier_products.spec_snapshot", null);

    if (categoryId) q = q.eq("category_id", categoryId);
    q = q.order("updated_at", { ascending: true }).range(offset, offset + scanPageSize - 1);

    const { data, error } = await withPostgrestTransientRetry("products.scrape-queue", async () => await q);
    if (error) throw new Error(`scrape queue: ${error.message}`);

    const rows = ((data as unknown as QueueRow[]) ?? []).filter((r) => r.supplier_products?.[0]?.supplier_product_id);
    if (rows.length === 0) break;

    for (const r of rows) {
      out.push(r);
      if (out.length >= batchSize) break;
    }

    offset += rows.length;
    if (rows.length < scanPageSize) break;
  }

  return out;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchProductHtml(
  url: string,
  referer: string,
  jar: Map<string, string>,
  origin: string
): Promise<Response> {
  return fetchWithSession(url, {
    jar,
    userAgent: SCRAPE_PRODUCT_HEADERS.userAgent,
    referer,
    acceptJson: false,
    acceptOverride: SCRAPE_PRODUCT_HEADERS.acceptOverride,
    acceptLanguage: SCRAPE_PRODUCT_HEADERS.acceptLanguage,
    origin
  });
}

function responseLooksLikeCaptchaChallenge(html: string, httpStatus: number): boolean {
  if (httpStatus === 429) return true;
  const h = html.slice(0, 20_000).toLowerCase();
  if (h.includes("cf-browser-verification")) return true;
  if (h.includes("cf-turnstile") || h.includes("challenges.cloudflare.com/turnstile")) return true;
  if (h.includes("captcha challenge completion required")) return true;
  if (/<title>\s*captcha\s*<\/title>/i.test(html)) return true;
  if (h.includes("checking your browser before accessing")) return true;
  if (h.includes("just a moment") && h.includes("enable javascript")) return true;
  if (h.includes("attention required") && h.includes("cloudflare")) return true;
  if (h.includes("access denied") && (h.includes("cloudflare") || h.includes("forbidden"))) return true;
  return false;
}

async function fetchIponProductDetailHtmlOnce(
  url: string,
  listingUrl: string,
  jar: Map<string, string>,
  origin: string
): Promise<{ ok: true; html: string } | { ok: false; captcha: boolean; error?: string }> {
  const referer = getRandomReferer(listingUrl);
  try {
    const res = await fetchProductHtml(url, referer, jar, origin);
    const html = await res.text();
    if (responseLooksLikeCaptchaChallenge(html, res.status)) {
      console.log("[iPon scrape] Zaštita / challenge — zaustavljanje batch-a.");
      if (CAPTCHA_SLEEP_MS > 0) {
        console.log(`[iPon scrape] Pauza ${CAPTCHA_SLEEP_MS}ms…`);
        await sleep(CAPTCHA_SLEEP_MS);
      }
      return { ok: false, captcha: true };
    }
    if (!res.ok) return { ok: false, captcha: false, error: `HTTP ${res.status}` };
    return { ok: true, html };
  } catch (e) {
    return { ok: false, captcha: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Public run function
// ---------------------------------------------------------------------------

export type IponScrapeDetailsResult = {
  success: boolean;
  processed: number;
  skipped: number;
  stoppedForCaptcha: boolean;
  stoppedForRisk: boolean;
  errors: number;
  detailRequests: number;
  batches: number;
};

export type RunIponScrapeDetailsOptions = {
  listingWarmupUrl?: string;
  categoryId?: string;
  runUntilQueueEmpty?: boolean;
  dryRun?: boolean;
};

export async function runIponScrapeDetails(
  options?: RunIponScrapeDetailsOptions
): Promise<IponScrapeDetailsResult> {
  const supabase = createSupabaseServiceClient();
  const supplierAttributeMappings = await loadAttributeMappings(IPON_SUPPLIER_ID, { supabase });

  const categoryId = options?.categoryId;
  const listingUrl =
    options?.listingWarmupUrl ??
    getIponListingUrlByInternalCategoryId(categoryId) ??
    getDefaultIponListingUrl();
  const runUntilQueueEmpty = options?.runUntilQueueEmpty ?? false;
  const dryRun = options?.dryRun ?? false;
  const batchSize = scrapeBatchSize();
  const maxDetailRequests = maxDetailRequestsForRun(batchSize);
  const origin = getIponOrigin(listingUrl);
  const jar = createIponCookieJar();

  if (categoryId) console.log("[iPon scrape] Filtar: category_id =", categoryId);
  console.log(
    runUntilQueueEmpty
      ? "[iPon scrape] Režim: više batch-eva dok red ne ostane prazan."
      : "[iPon scrape] Režim: jedan batch."
  );
  if (dryRun) {
    console.log("[iPon scrape] Dry-run: bez HTTP i bez DB upisa.");
  } else {
    console.log(`[iPon scrape] HTML detail request budget: ${maxDetailRequests}`);
  }

  if (!dryRun) {
    console.log("[iPon scrape] Warmup sesije…");
    await warmupIponSessionForListing(jar, listingUrl);
    await sleep(productDelayMs(categoryId));
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let stoppedForCaptcha = false;
  let stoppedForRisk = false;
  let detailRequests = 0;
  let batches = 0;

  for (;;) {
    batches += 1;
    // Svaki batch ima svoj HTML budžet; inače bi prvi batch potrošio cijeli limit i drain režim bi stao.
    if (runUntilQueueEmpty) detailRequests = 0;

    console.log(`[iPon scrape] Batch ${batches} (max ${batchSize} proizvoda)…`);

    let rows: QueueRow[];
    try {
      rows = await fetchIponScrapeQueueBatch(supabase, categoryId, batchSize);
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }

    if (rows.length === 0) {
      console.log("[iPon scrape] Red prazan — kraj.");
      break;
    }

    for (const r of rows) {
      const sp = r.supplier_products?.[0];
      if (!sp?.supplier_product_id) {
        skipped += 1;
        continue;
      }

      const raw = sp.raw_json;
      if (!raw || typeof raw !== "object") {
        skipped += 1;
        if (!dryRun) await sleep(productDelayMs(r.category_id));
        continue;
      }

      const item = raw as IponProductItem;
      const url = getIponProductDetailUrl(item);

      // Try extracting from raw_json first (avoids HTTP)
      const rawParsed = parseIponProductDetailsFromRawJson(raw);
      if (rawParsed.productEntityCount > 0 && (rawParsed.mpn || rawParsed.ean || rawParsed.specRows.length > 0)) {
        if (dryRun) {
          console.log(`[iPon scrape][dry-run] raw_json covers data for: ${url}`);
          skipped += 1;
          continue;
        }
        const mpnN = normalizeMpn(rawParsed.mpn);
        const eanN = normalizeEan(rawParsed.ean);
        await syncIdentifiers(supabase, r.id, sp.supplier_product_id, mpnN, eanN, dryRun);
        await saveSpecSnapshot(supabase, sp.supplier_product_id, rawParsed);
        processed += 1;
        await sleep(productDelayMs(r.category_id));
        continue;
      }

      // Need HTTP detail fetch
      if (dryRun) {
        console.log(`[iPon scrape][dry-run] Trebao bi HTML detail za: ${url}`);
        skipped += 1;
        continue;
      }

      if (detailRequests >= maxDetailRequests) {
        console.log(`[iPon scrape] Zaustavljeno: dostignut HTML request budget (${maxDetailRequests}).`);
        stoppedForRisk = true;
        break;
      }

      console.log("Scraping product:", url);
      detailRequests += 1;

      const res = await fetchIponProductDetailHtmlOnce(url, listingUrl, jar, origin);

      if (!res.ok) {
        if (res.captcha) {
          stoppedForCaptcha = true;
          break;
        }
        console.error("Fetch failed:", res.error ?? "unknown");
        errors += 1;
        await sleep(productDelayMs(r.category_id));
        continue;
      }

      const parsed = parseIponProductJsonLdFromHtml(res.html);
      console.log("MPN:", parsed.mpn ?? "(none)");
      console.log("EAN:", parsed.ean ?? "(none)");
      console.log("factory_link:", parsed.factory_link ?? "(none)");

      if (parsed.productEntityCount === 0) {
        const hasLd = res.html.includes("application/ld+json");
        console.warn(
          hasLd
            ? `Nema prepoznatog Product u JSON-LD za ${url}.`
            : `Nema <script type="application/ld+json"> u odgovoru za ${url} — vjerojatno WAF/Cloudflare.`
        );
        stoppedForRisk = true;
        errors += 1;
        break;
      }

      const mpnN = normalizeMpn(parsed.mpn);
      const eanN = normalizeEan(parsed.ean);
      await syncIdentifiers(supabase, r.id, sp.supplier_product_id, mpnN, eanN, dryRun);

      // Build nameToSlug for enrichment hint (resolver used only by enrichment job now,
      // but we keep the attribute mappings call to verify DB config is healthy)
      const _nameToSlug = buildAttributeSlugResolver(supplierAttributeMappings, r.category_id, mapSpecNameToSlug);
      void _nameToSlug;

      await saveSpecSnapshot(supabase, sp.supplier_product_id, parsed);
      processed += 1;

      await sleep(productDelayMs(r.category_id));
    }

    if (stoppedForCaptcha) {
      console.log("[iPon scrape] Zaustavljeno zbog CAPTCHA-e.");
      break;
    }
    if (stoppedForRisk) {
      console.log("[iPon scrape] Zaustavljeno zbog risk signala.");
      break;
    }
    if (!runUntilQueueEmpty) break;
    console.log(`[iPon scrape] Pauza između batch-eva ${BATCH_GAP_MS}ms…`);
    await sleep(BATCH_GAP_MS);
  }

  console.log(
    `[iPon scrape] Sažetak: batch-eva=${batches}, obrađeno=${processed}, grešaka=${errors}, preskočeno=${skipped}, html_requests=${detailRequests}, captcha_stop=${stoppedForCaptcha}, risk_stop=${stoppedForRisk}`
  );

  return {
    success: !stoppedForCaptcha && !stoppedForRisk && errors === 0,
    processed,
    skipped,
    stoppedForCaptcha,
    stoppedForRisk,
    errors,
    detailRequests,
    batches
  };
}
