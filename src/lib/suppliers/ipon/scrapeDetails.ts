/**
 * iPon: JSON-LD detalji (MPN, EAN, specifikacije) — odvojeno od API importa.
 * Run: npx tsx scripts/run-ipon-scrape-details.ts
 */

import { createHash } from "node:crypto";
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
import {
  allConfiguredDetailAttributeSlugs,
  getRandomReferer,
  getRequiredAttributesForCategory,
  IPON_MOTHERBOARD_CATEGORY_ID,
  IPON_CPU_DETAIL_ATTRIBUTE_SLUGS,
  randomDelay
} from "./scrape-config";
import { withPostgrestTransientRetry } from "./transient-retry";

/** Slugovi za upis/pokrivenost za ovaj proizvod (iz `category_id` reda ili filtera run-a). */
function resolveDetailAttributeSlugsForProduct(
  productCategoryId: string | null | undefined,
  runCategoryFilterId: string | undefined,
  optionsOverride: readonly string[] | undefined
): readonly string[] {
  if (optionsOverride?.length) return optionsOverride;
  const id = productCategoryId ?? runCategoryFilterId;
  if (!id) return IPON_CPU_DETAIL_ATTRIBUTE_SLUGS;
  return getRequiredAttributesForCategory(id) ?? [];
}

/** Isti UA/jezik kao warmup/import — drugačiji fingerprint na prvom GET-u lako pokreće WAF/challenge. */
const SCRAPE_PRODUCT_HEADERS = {
  userAgent: IPON_IMPORT_USER_AGENT,
  acceptOverride: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  acceptLanguage: IPON_ACCEPT_LANGUAGE
} as const;

function isMotherboardCategory(categoryId: string | null | undefined): boolean {
  return categoryId === IPON_MOTHERBOARD_CATEGORY_ID;
}

function scrapeBatchSize(categoryId: string | undefined): number {
  const fallback = isMotherboardCategory(categoryId) ? 2 : 8;
  const min = isMotherboardCategory(categoryId) ? 1 : 5;
  const max = isMotherboardCategory(categoryId)
    ? iponNumEnv("IPON_SCRAPE_BATCH_SIZE_MAX", 20)
    : iponNumEnv("IPON_SCRAPE_BATCH_SIZE_MAX", 10);
  return Math.min(max, Math.max(min, iponNumEnv("IPON_SCRAPE_BATCH_SIZE", fallback)));
}

function productDelayMs(categoryId: string | null | undefined): number {
  const min = isMotherboardCategory(categoryId)
    ? iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_MIN_MS", 60_000)
    : iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_MIN_MS", 4000);
  const jitter = isMotherboardCategory(categoryId)
    ? iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_JITTER_MS", 120_000)
    : iponNumEnv("IPON_SCRAPE_PRODUCT_DELAY_JITTER_MS", 2000);
  return randomDelay(min, jitter);
}

function maxDetailRequestsForRun(categoryId: string | undefined, batchSize: number): number {
  const fallback = isMotherboardCategory(categoryId) ? 3 : batchSize;
  return Math.max(0, iponNumEnv("IPON_SCRAPE_MAX_DETAIL_REQUESTS", fallback));
}

type SpecRow = { name: string; value: string };

type ParsedIponJsonLd = {
  mpn: string | null;
  ean: string | null;
  specRows: SpecRow[];
  productEntityCount: number;
  /**
   * Raw `Product` JSON-LD objekti pronađeni u HTML-u. Koristi se za snapshot
   * u `products.source_jsonld` (FAZA 6 — re-extraction bez novog HTTP poziva).
   * Za parser iz raw_json-a (`parseIponProductDetailsFromRawJson`) ostaje prazan jer
   * ne raspolažemo izvornim JSON-LD blokovima.
   */
  rawProductJsonLd?: Record<string, unknown>[];
};

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
      /* skip */
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

/** Podržava i skraćeni `@type: Product` i puni IRI npr. `https://schema.org/Product` (iPon / mnogi shopovi). */
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

function valueToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.value === "number" || typeof o.value === "string") return String(o.value);
    if (typeof o.name === "string") return o.name;
  }
  return "";
}

function collectAdditionalProperty(node: Record<string, unknown>, acc: SpecRow[]): void {
  const ap = node.additionalProperty;
  if (!ap) return;
  const list = Array.isArray(ap) ? ap : [ap];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const value = valueToString(o.value);
    if (name && value) acc.push({ name, value });
  }
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
  const specRows: SpecRow[] = [];

  for (const p of products) {
    if (typeof p.mpn === "string" && p.mpn.trim()) mpn = p.mpn.trim();
    if (typeof p.gtin13 === "string" && p.gtin13.trim()) ean = p.gtin13.trim();
    if (typeof p.gtin === "string" && p.gtin.trim() && !ean) ean = p.gtin.trim();
    if (typeof p.gtin14 === "string" && p.gtin14.trim() && !ean) ean = p.gtin14.trim();
    collectAdditionalProperty(p, specRows);
  }

  return {
    mpn,
    ean,
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
    specRows: [],
    productEntityCount: 0
  };
  walkRawProductData(raw, parsed);
  if (parsed.mpn || parsed.ean || parsed.specRows.length > 0) parsed.productEntityCount = 1;
  return parsed;
}

function normSpec(s: string): string {
  return s.trim().toLowerCase();
}

function mapSpecNameToSlug(name: string): string | null {
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

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const keys = Object.keys(val as Record<string, unknown>).sort();
      const sorted: Record<string, unknown> = {};
      for (const k of keys) sorted[k] = (val as Record<string, unknown>)[k];
      return sorted;
    }
    return val;
  });
}

/**
 * Idempotentno upisuje `products.source_jsonld` (+ hash, fetched_at, supplier_id,
 * supplier_product_id). Ako se hash ne mijenja, ne pravimo bespotreban WRITE.
 *
 * Greške ovdje su non-fatal — JSON-LD snapshot je dodatak, ne briše postojeću
 * logiku obogaćivanja.
 */
async function maybeSaveProductJsonLdSnapshot(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  rawProducts: Record<string, unknown>[]
): Promise<void> {
  try {
    const snapshot = rawProducts.length === 1 ? rawProducts[0] : rawProducts;
    const stable = stableStringify(snapshot);
    const hash = createHash("sha256").update(stable).digest("hex");

    const { data: existing, error: readErr } = await withPostgrestTransientRetry(
      "products.jsonld-current",
      async () =>
        await supabase
          .from("products")
          .select("source_jsonld_hash")
          .eq("id", productId)
          .maybeSingle()
    );
    if (readErr) {
      console.warn("[iPon JSON-LD snapshot] read current hash failed:", readErr.message);
      return;
    }
    const currentHash = (existing as { source_jsonld_hash: string | null } | null)?.source_jsonld_hash ?? null;
    if (currentHash === hash) return;

    const { error: updateErr } = await withPostgrestTransientRetry(
      "products.jsonld-update",
      async () =>
        await supabase
          .from("products")
          .update({
            source_jsonld: snapshot,
            source_jsonld_hash: hash,
            source_jsonld_fetched_at: new Date().toISOString(),
            source_jsonld_supplier_id: IPON_SUPPLIER_ID,
            source_jsonld_supplier_product_id: supplierProductId
          })
          .eq("id", productId)
    );
    if (updateErr) {
      console.warn("[iPon JSON-LD snapshot] update failed:", updateErr.message);
    }
  } catch (err) {
    console.warn("[iPon JSON-LD snapshot] unexpected error:", err instanceof Error ? err.message : String(err));
  }
}

async function applyIponParsedDetailsToDatabase(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  parsed: ParsedIponJsonLd,
  slugToAttributeId: Map<string, string>,
  detailAttributeSlugs: readonly string[],
  options?: {
    markComplete?: boolean;
    dryRun?: boolean;
    /**
     * Pre-built mapper from supplier spec name to internal attribute slug.
     * Falls back to the hardcoded `mapSpecNameToSlug` if not provided so existing
     * callers (and the no-DB-config case) keep identical behaviour.
     */
    nameToSlug?: (name: string) => string | null;
  }
): Promise<{ ok: boolean; wrote: boolean }> {
  const mpnN = normalizeMpn(parsed.mpn);
  const eanN = normalizeEan(parsed.ean);
  const markComplete = options?.markComplete ?? true;
  const dryRun = options?.dryRun ?? false;
  const nameToSlug = options?.nameToSlug ?? mapSpecNameToSlug;

  const bySlug = new Map<string, string>();
  for (const row of parsed.specRows) {
    const slug = nameToSlug(row.name);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, row.value.trim());
  }
  const { vga: vgaP, chip: chipP } = splitIntegratedVga(parsed.specRows);
  if (vgaP) bySlug.set("integrated_vga", vgaP);
  if (chipP) bySlug.set("integrated_vga_chip", chipP);

  const { data: currentProduct, error: currentProductErr } = await withPostgrestTransientRetry(
    "products.current-enrichment",
    async () =>
      await supabase
        .from("products")
        .select("mpn, ean, attributes")
        .eq("id", productId)
        .maybeSingle()
  );
  if (currentProductErr) {
    console.error("[iPon] products current lookup:", currentProductErr.message);
    return { ok: false, wrote: false };
  }

  const { data: currentSupplierProduct, error: currentSupplierErr } = await withPostgrestTransientRetry(
    "supplier_products.current-enrichment",
    async () =>
      await supabase
        .from("supplier_products")
        .select("mpn, ean")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
        .maybeSingle()
  );
  if (currentSupplierErr) {
    console.error("[iPon] supplier_products current lookup:", currentSupplierErr.message);
    return { ok: false, wrote: false };
  }

  let wouldWrite = 0;
  if (mpnN && !normalizeMpn(currentProduct?.mpn)) wouldWrite += 1;
  if (eanN && !normalizeEan(currentProduct?.ean)) wouldWrite += 1;
  if (mpnN && !normalizeMpn(currentSupplierProduct?.mpn)) wouldWrite += 1;
  if (eanN && !normalizeEan(currentSupplierProduct?.ean)) wouldWrite += 1;

  for (const slug of detailAttributeSlugs) {
    const val = bySlug.get(slug);
    const attributeId = slugToAttributeId.get(slug);
    if (!val || !attributeId) continue;
    const { data: existing } = await withPostgrestTransientRetry(
      "product_attributes.existing-count",
      async () =>
        await supabase
          .from("product_attributes")
          .select("id")
          .eq("product_id", productId)
          .eq("attribute_id", attributeId)
          .maybeSingle()
    );
    if (!existing?.id) wouldWrite += 1;
  }

  if (!mpnN && !eanN && wouldWrite === 0) {
    if (markComplete && !dryRun) {
      const { error: failErr } = await supabase
        .from("supplier_products")
        .update({ enrichment_status: "failed", updated_at: new Date().toISOString() })
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId);
      if (failErr) console.error("[iPon] supplier_products failed status:", failErr.message);
    }
    return { ok: false, wrote: false };
  }

  if (dryRun) {
    console.log(
      `[iPon scrape][dry-run] ${supplierProductId}: would write ${wouldWrite} missing field/attribute value(s).`
    );
    return { ok: true, wrote: wouldWrite > 0 };
  }

  const prodUpdate: Record<string, string> = {};
  if (mpnN && !normalizeMpn(currentProduct?.mpn)) prodUpdate.mpn = mpnN;
  if (eanN && !normalizeEan(currentProduct?.ean)) prodUpdate.ean = eanN;
  if (Object.keys(prodUpdate).length > 0) {
    const { error: prodErr } = await supabase
      .from("products")
      .update({
        ...prodUpdate,
        updated_at: new Date().toISOString()
      })
      .eq("id", productId);
    if (prodErr) {
      console.error("[iPon] products mpn/ean update:", prodErr.message);
      return { ok: false, wrote: false };
    }
  }

  for (const slug of detailAttributeSlugs) {
    const val = bySlug.get(slug);
    const attributeId = slugToAttributeId.get(slug);
    if (!val || !attributeId) continue;

    const { data: existing } = await withPostgrestTransientRetry(
      "product_attributes.existing-write",
      async () =>
        await supabase
          .from("product_attributes")
          .select("id")
          .eq("product_id", productId)
          .eq("attribute_id", attributeId)
          .maybeSingle()
    );

    if (!existing?.id) {
      await supabase.from("product_attributes").insert({
        product_id: productId,
        attribute_id: attributeId,
        value: val
      });
    }
  }

  const attrObject: Record<string, string> = {};
  for (const slug of detailAttributeSlugs) {
    const v = bySlug.get(slug);
    if (v) attrObject[slug] = v;
  }
  if (Object.keys(attrObject).length > 0) {
    const { data: prev } = await supabase.from("products").select("attributes").eq("id", productId).maybeSingle();
    const prevAttrs =
      prev?.attributes && typeof prev.attributes === "object" && !Array.isArray(prev.attributes)
        ? (prev.attributes as Record<string, unknown>)
        : {};
    const missingJsonAttrs: Record<string, string> = {};
    for (const [slug, value] of Object.entries(attrObject)) {
      if (prevAttrs[slug] == null || String(prevAttrs[slug]).trim() === "") missingJsonAttrs[slug] = value;
    }
    if (Object.keys(missingJsonAttrs).length > 0) {
      const merged = { ...prevAttrs, ...missingJsonAttrs };
      await supabase
        .from("products")
        .update({
          attributes: merged as Record<string, unknown>,
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);
    }
  }

  const spNow = new Date().toISOString();
  const supplierUpdate: Record<string, string> = {
    enrichment_status: markComplete ? "complete" : "pending",
    updated_at: spNow
  };
  if (mpnN && !normalizeMpn(currentSupplierProduct?.mpn)) supplierUpdate.mpn = mpnN;
  if (eanN && !normalizeEan(currentSupplierProduct?.ean)) supplierUpdate.ean = eanN;
  if (markComplete) supplierUpdate.specs_fetched_at = spNow;

  const { error: spErr } = await supabase
    .from("supplier_products")
    .update(supplierUpdate)
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .eq("supplier_product_id", supplierProductId);
  if (spErr) {
    console.error("[iPon] supplier_products mpn/ean/complete update:", spErr.message);
    return { ok: false, wrote: false };
  }

  return { ok: true, wrote: wouldWrite > 0 };
}

/**
 * WAF/challenge stranice (često HTTP 200 bez JSON-LD-a). Ne koristiti generički „captcha“ u cijelom dokumentu.
 */
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

/** Nakon detekcije challenge-a: podrazumijevano 0 ms (ne zaključavaj terminal). Postavi IPON_SCRAPE_CAPTCHA_SLEEP_MS ako želiš pauzu. */
const CAPTCHA_SLEEP_MS = iponNumEnv("IPON_SCRAPE_CAPTCHA_SLEEP_MS", 0);

async function loadAttributeSlugMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const slugList = allConfiguredDetailAttributeSlugs();
  const slugsToLoad = slugList.length > 0 ? slugList : [...IPON_CPU_DETAIL_ATTRIBUTE_SLUGS];
  const { data: attrRows, error } = await withPostgrestTransientRetry(
    "attributes.slug-map",
    async () => await supabase.from("attributes").select("id, slug").in("slug", slugsToLoad)
  );
  if (error) throw new Error(`attributes slug map: ${error.message}`);

  const slugToAttributeId = new Map<string, string>();
  for (const a of attrRows ?? []) {
    if (a.slug && a.id) slugToAttributeId.set(a.slug, a.id);
  }
  return slugToAttributeId;
}

type QueueRow = {
  id: string;
  category_id: string | null;
  mpn: string | null;
  ean: string | null;
  attributes?: unknown;
  supplier_products: {
    supplier_product_id: string;
    raw_json: unknown;
    mpn?: string | null;
    ean?: string | null;
    enrichment_status?: string | null;
  }[];
};

type ExistingAttributeMap = Map<string, Set<string>>;

function hasNormalizedValue(value: string | null | undefined, normalize: (v: string | null | undefined) => string | null): boolean {
  return normalize(value) !== null;
}

/**
 * Detail completion is stored in both `product_attributes` and `products.attributes` (jsonb).
 * The queue used to only look at `product_attributes`; if the JSONB was filled (e.g. by a
 * previous scrape or import) but the join rows were missing, the same product stayed in the
 * queue forever (e.g. "MSI PRO B860-P" with EAN/MPN in DB but no row for one slug in `product_attributes`).
 */
function attributeSatisfiedInProductsJsonb(r: QueueRow, slug: string): boolean {
  const a = r.attributes;
  if (!a || typeof a !== "object" || Array.isArray(a)) return false;
  const v = (a as Record<string, unknown>)[slug];
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0;
}

function missingDetailAttributeSlugs(
  r: QueueRow,
  detailSlugs: readonly string[],
  slugToAttributeId: Map<string, string>,
  existingAttributes: ExistingAttributeMap
): string[] {
  const existing = existingAttributes.get(r.id) ?? new Set<string>();
  return detailSlugs.filter((slug) => {
    const attributeId = slugToAttributeId.get(slug);
    if (!attributeId) return false;
    if (existing.has(attributeId)) return false;
    if (attributeSatisfiedInProductsJsonb(r, slug)) return false;
    return true;
  });
}

function parsedHasMappedValue(parsed: ParsedIponJsonLd, slug: string): boolean {
  for (const row of parsed.specRows) {
    const mapped = mapSpecNameToSlug(row.name);
    if (mapped === slug && row.value.trim()) return true;
  }
  if (slug === "integrated_vga" || slug === "integrated_vga_chip") {
    const split = splitIntegratedVga(parsed.specRows);
    return slug === "integrated_vga" ? Boolean(split.vga) : Boolean(split.chip);
  }
  return false;
}

function parsedCoversMissingValues(
  r: QueueRow,
  parsed: ParsedIponJsonLd,
  detailSlugs: readonly string[],
  slugToAttributeId: Map<string, string>,
  existingAttributes: ExistingAttributeMap
): boolean {
  const sp = r.supplier_products?.[0];
  if (!sp?.supplier_product_id) return false;
  const mpnN = normalizeMpn(parsed.mpn);
  const eanN = normalizeEan(parsed.ean);
  if ((!hasNormalizedValue(r.mpn, normalizeMpn) || !hasNormalizedValue(sp.mpn, normalizeMpn)) && !mpnN) return false;
  if ((!hasNormalizedValue(r.ean, normalizeEan) || !hasNormalizedValue(sp.ean, normalizeEan)) && !eanN) return false;
  for (const slug of missingDetailAttributeSlugs(r, detailSlugs, slugToAttributeId, existingAttributes)) {
    if (!parsedHasMappedValue(parsed, slug)) return false;
  }
  return true;
}

function productRowNeedsIponDetailScrape(
  r: QueueRow,
  detailSlugs: readonly string[],
  slugToAttributeId: Map<string, string>,
  existingAttributes: ExistingAttributeMap
): boolean {
  const sp = r.supplier_products?.[0];
  if (!sp?.supplier_product_id) return false;
  if (!hasNormalizedValue(r.mpn, normalizeMpn) || !hasNormalizedValue(r.ean, normalizeEan)) return true;
  if (!hasNormalizedValue(sp.mpn, normalizeMpn) || !hasNormalizedValue(sp.ean, normalizeEan)) return true;
  return missingDetailAttributeSlugs(r, detailSlugs, slugToAttributeId, existingAttributes).length > 0;
}

async function loadExistingAttributeMap(
  supabase: SupabaseClient,
  rows: QueueRow[],
  slugToAttributeId: Map<string, string>,
  runCategoryFilterId: string | undefined,
  optionsOverride: readonly string[] | undefined
): Promise<ExistingAttributeMap> {
  const productIds = rows.map((r) => r.id);
  const attributeIds = new Set<string>();
  for (const r of rows) {
    const slugs = resolveDetailAttributeSlugsForProduct(r.category_id, runCategoryFilterId, optionsOverride);
    for (const slug of slugs) {
      const attributeId = slugToAttributeId.get(slug);
      if (attributeId) attributeIds.add(attributeId);
    }
  }
  if (productIds.length === 0 || attributeIds.size === 0) return new Map();

  const { data, error } = await withPostgrestTransientRetry(
    "product_attributes.existing-map",
    async () =>
      await supabase
        .from("product_attributes")
        .select("product_id, attribute_id")
        .in("product_id", productIds)
        .in("attribute_id", Array.from(attributeIds))
  );
  if (error) throw new Error(`product_attributes existing lookup: ${error.message}`);

  const out: ExistingAttributeMap = new Map();
  for (const row of data ?? []) {
    const r = row as { product_id: string; attribute_id: string };
    if (!out.has(r.product_id)) out.set(r.product_id, new Set());
    out.get(r.product_id)!.add(r.attribute_id);
  }
  return out;
}

/**
 * Red: iPon artikli kojima stvarno fali MPN/EAN ili konfigurisani atribut.
 * Status `complete` se više ne tretira kao dovoljan ako su podaci prazni.
 */
async function fetchIponScrapeQueueBatch(
  supabase: SupabaseClient,
  categoryId: string | undefined,
  batchSize: number,
  slugToAttributeId: Map<string, string>,
  optionsOverride: readonly string[] | undefined
): Promise<QueueRow[]> {
  const sel = `
      id,
      category_id,
      mpn,
      ean,
      attributes,
      supplier_products!inner (
        supplier_id,
        supplier_product_id,
        raw_json,
        mpn,
        ean,
        enrichment_status
      )
    `;

  const out: QueueRow[] = [];
  const scanPageSize = Math.max(batchSize * 20, 50);
  const maxScan = iponNumEnv("IPON_SCRAPE_QUEUE_SCAN_LIMIT", isMotherboardCategory(categoryId) ? 1000 : 500);
  let offset = 0;

  while (out.length < batchSize && offset < maxScan) {
    let q = supabase.from("products").select(sel).eq("supplier_products.supplier_id", IPON_SUPPLIER_ID);
    if (categoryId) q = q.eq("category_id", categoryId);
    q = q.order("updated_at", { ascending: true }).range(offset, offset + scanPageSize - 1);

    const { data, error } = await withPostgrestTransientRetry("products.scrape-queue", async () => await q);
    if (error) throw new Error(`scrape queue (missing enrichment): ${error.message}`);

    const rows = ((data as unknown as QueueRow[]) ?? []).filter((r) => r.supplier_products?.[0]?.supplier_product_id);
    if (rows.length === 0) break;

    const existingAttributes = await loadExistingAttributeMap(
      supabase,
      rows,
      slugToAttributeId,
      categoryId,
      optionsOverride
    );
    for (const r of rows) {
      const slugs = resolveDetailAttributeSlugsForProduct(r.category_id, categoryId, optionsOverride);
      if (productRowNeedsIponDetailScrape(r, slugs, slugToAttributeId, existingAttributes)) out.push(r);
      if (out.length >= batchSize) break;
    }

    offset += rows.length;
    if (rows.length < scanPageSize) break;
  }

  return out;
}

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

/**
 * Jedan HTTP poziv po proizvodu — bez retry petlje (ponovni pokušaj kroz red u bazi).
 * Challenge: stop batcha; opciona pauza IPON_SCRAPE_CAPTCHA_SLEEP_MS (default 0).
 */
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
      console.log(
        "[iPon scrape] Zaštita / challenge na odgovoru — zaustavljanje batch-a. (Rate-limit s iPona je na IP-u, ne od ove skripte.)"
      );
      if (CAPTCHA_SLEEP_MS > 0) {
        console.log(`[iPon scrape] Pauza ${CAPTCHA_SLEEP_MS}ms (IPON_SCRAPE_CAPTCHA_SLEEP_MS)…`);
        await sleep(CAPTCHA_SLEEP_MS);
      }
      return { ok: false, captcha: true };
    }
    if (!res.ok) {
      return { ok: false, captcha: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, html };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, captcha: false, error: msg };
  }
}

export type IponScrapeDetailsResult = {
  success: boolean;
  processed: number;
  skipped: number;
  stoppedForCaptcha: boolean;
  stoppedForRisk: boolean;
  errors: number;
  detailRequests: number;
  /** Koliko je batch-eva odrađeno (1 batch = do `BATCH_SIZE` proizvoda). */
  batches: number;
};

export type RunIponScrapeDetailsOptions = {
  /** Referer listing (isti warmup kao import). Podrazumevano prva kategorija iz `IPON_CATEGORIES`. */
  listingWarmupUrl?: string;
  /** Samo `products.category_id` (npr. iz `getIponCategoryInternalIdByName("procesori")`). */
  categoryId?: string;
  /** Ponavlja batch-eve dok upit ne vrati 0 redova (cijela kategorija / svi pending). */
  runUntilQueueEmpty?: boolean;
  /**
   * Koji slugovi se upisuju pri scrape-u (`resolveDetailAttributeSlugsForProduct`). Red se bira samo po
   * `supplier_products.enrichment_status` (vidi `fetchIponScrapeQueueBatch`).
   */
  requiredDetailAttributeSlugs?: readonly string[];
  /** Samo ispiši red i potencijalne upise; bez HTTP detail fetch-a i bez DB upisa. */
  dryRun?: boolean;
};

const BATCH_GAP_MS = iponNumEnv("IPON_SCRAPE_BATCH_GAP_MS", 3000);

export async function runIponScrapeDetails(
  options?: RunIponScrapeDetailsOptions
): Promise<IponScrapeDetailsResult> {
  const supabase = createSupabaseServiceClient();
  const slugToAttributeId = await loadAttributeSlugMap(supabase);
  const supplierAttributeMappings = await loadAttributeMappings(IPON_SUPPLIER_ID, { supabase });

  const categoryId = options?.categoryId;
  const listingUrl = options?.listingWarmupUrl ?? getIponListingUrlByInternalCategoryId(categoryId) ?? getDefaultIponListingUrl();
  const runUntilQueueEmpty = options?.runUntilQueueEmpty ?? false;
  const requiredAttributeSlugs =
    options?.requiredDetailAttributeSlugs ?? getRequiredAttributesForCategory(categoryId);
  const dryRun = options?.dryRun ?? false;
  const batchSize = scrapeBatchSize(categoryId);
  const maxDetailRequests = maxDetailRequestsForRun(categoryId, batchSize);
  if (requiredAttributeSlugs?.length) {
    console.log("[iPon scrape] Obavezni atributi za red (attributes jsonb):", requiredAttributeSlugs.join(", "));
  }
  const origin = getIponOrigin(listingUrl);
  const jar = createIponCookieJar();

  if (categoryId) {
    console.log("[iPon scrape] Filtar: category_id =", categoryId);
  }
  console.log(
    runUntilQueueEmpty
      ? "[iPon scrape] Režim: više batch-eva dok red ne ostane prazan."
      : "[iPon scrape] Režim: jedan batch."
  );
  if (dryRun) {
    console.log("[iPon scrape] Dry-run: bez HTTP detail fetch-a i bez DB upisa.");
  } else {
    console.log(`[iPon scrape] HTML detail request budget za ovaj run: ${maxDetailRequests}`);
  }

  if (!dryRun) {
    console.log("[iPon scrape] Warmup sesije (isti tok kao import)…");
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
    console.log(`[iPon scrape] Batch ${batches} (max ${batchSize} proizvoda)…`);

    let rows: QueueRow[];
    try {
      rows = await fetchIponScrapeQueueBatch(
        supabase,
        categoryId,
        batchSize,
        slugToAttributeId,
        options?.requiredDetailAttributeSlugs
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    const existingAttributes = await loadExistingAttributeMap(
      supabase,
      rows,
      slugToAttributeId,
      categoryId,
      options?.requiredDetailAttributeSlugs
    );

    const queue: {
      product_id: string;
      supplier_product_id: string;
      category_id: string | null;
      raw_json: unknown;
      source: QueueRow;
      detailSlugs: readonly string[];
    }[] = [];
    for (const r of rows) {
      const sp = r.supplier_products?.[0];
      if (!sp?.supplier_product_id) continue;
      const detailSlugs = resolveDetailAttributeSlugsForProduct(
        r.category_id,
        categoryId,
        options?.requiredDetailAttributeSlugs
      );
      queue.push({
        product_id: r.id,
        supplier_product_id: sp.supplier_product_id,
        category_id: r.category_id,
        raw_json: sp.raw_json,
        source: r,
        detailSlugs
      });
    }

    if (queue.length === 0) {
      console.log("[iPon scrape] Red prazan — kraj.");
      break;
    }

    for (const row of queue) {
      const raw = row.raw_json;
      if (!raw || typeof raw !== "object") {
        skipped += 1;
        if (!dryRun) await sleep(productDelayMs(row.category_id ?? categoryId));
        continue;
      }
      const item = raw as IponProductItem;
      const url = getIponProductDetailUrl(item);
      const rawParsed = parseIponProductDetailsFromRawJson(raw);
      const rawCoversMissing = parsedCoversMissingValues(
        row.source,
        rawParsed,
        row.detailSlugs,
        slugToAttributeId,
        existingAttributes
      );
      let rowWrote = false;

      if (rawParsed.productEntityCount > 0) {
        const rowNameToSlug = buildAttributeSlugResolver(
          supplierAttributeMappings,
          row.category_id,
          mapSpecNameToSlug
        );
        const rawOut = await applyIponParsedDetailsToDatabase(
          supabase,
          row.product_id,
          row.supplier_product_id,
          rawParsed,
          slugToAttributeId,
          row.detailSlugs,
          { markComplete: rawCoversMissing, dryRun, nameToSlug: rowNameToSlug }
        );
        rowWrote = rawOut.wrote;
        if (rawCoversMissing) {
          if (rowWrote) processed += 1;
          else skipped += 1;
          if (!dryRun) await sleep(productDelayMs(row.category_id ?? categoryId));
          continue;
        }
      }

      if (dryRun) {
        console.log(`[iPon scrape][dry-run] Trebao bi HTML detail za: ${url}`);
        skipped += 1;
        continue;
      }

      if (detailRequests >= maxDetailRequests) {
        console.log(
          `[iPon scrape] Zaustavljeno: dostignut HTML detail request budget (${maxDetailRequests}) za ovaj run.`
        );
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
        await sleep(productDelayMs(row.category_id ?? categoryId));
        continue;
      }

      const parsed = parseIponProductJsonLdFromHtml(res.html);
      console.log("MPN:", parsed.mpn ?? "(none)");
      console.log("EAN:", parsed.ean ?? "(none)");

      if (parsed.productEntityCount === 0) {
        const hasLd = res.html.includes("application/ld+json");
        console.warn(
          hasLd
            ? `Nema prepoznatog Product u JSON-LD za ${url} (provjeri @type / strukturu).`
            : `Nema <script type="application/ld+json"> u odgovoru za ${url} — često Cloudflare/WAF umjesto prave PDP (u browseru vidiš drugačiji HTML).`
        );
        stoppedForRisk = true;
        errors += 1;
        break;
      }

      const htmlNameToSlug = buildAttributeSlugResolver(
        supplierAttributeMappings,
        row.category_id,
        mapSpecNameToSlug
      );

      if (parsed.rawProductJsonLd && parsed.rawProductJsonLd.length > 0) {
        await maybeSaveProductJsonLdSnapshot(
          supabase,
          row.product_id,
          row.supplier_product_id,
          parsed.rawProductJsonLd
        );
      }

      const out = await applyIponParsedDetailsToDatabase(
        supabase,
        row.product_id,
        row.supplier_product_id,
        parsed,
        slugToAttributeId,
        row.detailSlugs,
        { markComplete: true, dryRun: false, nameToSlug: htmlNameToSlug }
      );

      if (out.ok && (out.wrote || rowWrote)) processed += 1;
      else if (out.ok) skipped += 1;
      else errors += 1;

      await sleep(productDelayMs(row.category_id ?? categoryId));
    }

    if (stoppedForCaptcha) {
      console.log(
        "[iPon scrape] Zaustavljeno zbog CAPTCHA-e — ostatak reda NIJE obrađen. Ponovo pokreni istu komandu kasnije (nastavlja od preostalih)."
      );
      break;
    }
    if (stoppedForRisk) {
      console.log("[iPon scrape] Zaustavljeno zbog risk signala — ostatak reda NIJE obrađen.");
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
