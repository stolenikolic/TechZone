/**
 * iPon: RSC detalji (specifikacije, factory_link, galerija) — odvojeno od API importa.
 * Run: npx tsx scripts/run-ipon-scrape-details.ts
 *
 * Idempotencija: ako supplier_products.spec_snapshot IS NOT NULL → preskoči HTTP.
 * Dodavanje novog atributa u kategoriju ne zahtijeva re-scrape — samo re-run enrichment job-a.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { fetchWithSession } from "lib/suppliers/shared/http-session";
import { buildAttributeSlugResolver, loadAttributeMappings } from "lib/suppliers/registry";
import { IPON_SUPPLIER_ID } from "./categories";
import {
  IPON_ACCEPT_LANGUAGE,
  IPON_IMPORT_USER_AGENT,
  createIponCookieJar,
  numEnv as iponNumEnv,
  sleep
} from "./ipon-fetch";
import type { IponProductItem } from "./transformProduct";
import { getIponProductDetailUrl } from "./transformProduct";
import { ingestIponGalleryImages } from "./galleryImages";
import { randomDelay } from "./scrape-config";
import { isIponEnglishProductUrl, parseIponRscFlight, productIdFromIponUrl } from "./rscProduct";
import { withPostgrestTransientRetry } from "./transient-retry";
import { ensureIponXhrSession, iponXhrHeaders, type IponXhrSession } from "./xhrToken";
import { extractWarrantyMonthsFromSpecRows } from "./warranty-from-specs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import { collectAdditionalProperty as _collectAdditionalProperty } from "lib/suppliers/shared/spec-snapshot";

type QueueRow = {
  id: string;
  category_id: string | null;
  supplier_products: {
    supplier_product_id: string;
    raw_json: unknown;
    spec_snapshot: unknown;
  }[];
};

type QueueOfferRow = {
  supplier_product_id: string;
  raw_json: unknown;
  spec_snapshot: unknown;
  products:
    | { id: string; category_id: string | null }
    | { id: string; category_id: string | null }[]
    | null;
};

// ---------------------------------------------------------------------------
// HTTP config
// ---------------------------------------------------------------------------

const RSC_ACCEPT = "text/x-component";

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
// raw_json shortcut — only real spec rows, not feed MPN/EAN
// ---------------------------------------------------------------------------

export function collectAdditionalProperty(node: Record<string, unknown>, acc: SpecRow[]): void {
  _collectAdditionalProperty(node, acc);
}

function walkRawSpecRows(node: unknown, specRows: SpecRow[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) walkRawSpecRows(item, specRows);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  collectAdditionalProperty(record, specRows);
  for (const value of Object.values(record)) walkRawSpecRows(value, specRows);
}

function specRowsFromRawJson(raw: unknown): SpecRow[] {
  const specRows: SpecRow[] = [];
  walkRawSpecRows(raw, specRows);
  return specRows;
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
  if (n.includes("m.2") || n.includes("m2") || (n.includes("m-key") && n.includes("connector")))
    return "m2_connectors";
  return null;
}

function splitIntegratedVga(props: SpecRow[]): { vga: string | null; chip: string | null } {
  const vgas = props.filter(
    (p) => normSpec(p.name).includes("integrated") && normSpec(p.name).includes("vga")
  );
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
 * Idempotentno upisuje spec_snapshot. MPN i EAN se ne diraju.
 * warranty_months se postavlja samo ako je kolona još prazna.
 */
async function saveSpecSnapshot(
  supabase: SupabaseClient,
  supplierProductId: string,
  specRows: SpecRow[],
  factoryLink: string | null
): Promise<void> {
  try {
    const { vga, chip } = splitIntegratedVga(specRows);
    const extraSpecs: SpecRow[] = [];
    if (vga) extraSpecs.push({ name: "Integrated VGA", value: vga });
    if (chip) extraSpecs.push({ name: "Integrated VGA chip", value: chip });

    const snapshot: SpecSnapshot = {
      mpn: null,
      ean: null,
      factory_link: factoryLink,
      specs: [
        ...specRows.filter(
          (row) => !normSpec(row.name).includes("integrated") || !normSpec(row.name).includes("vga")
        ),
        ...extraSpecs
      ]
    };

    const warrantyMonths = extractWarrantyMonthsFromSpecRows(snapshot.specs);
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
      return;
    }

    if (warrantyMonths != null) {
      const { error: warrantyError } = await withPostgrestTransientRetry(
        "supplier_products.warranty-if-empty",
        async () =>
          await supabase
            .from("supplier_products")
            .update({ warranty_months: warrantyMonths, updated_at: now })
            .eq("supplier_id", IPON_SUPPLIER_ID)
            .eq("supplier_product_id", supplierProductId)
            .is("warranty_months", null)
      );
      if (warrantyError) console.warn("[iPon] warranty_months update failed:", warrantyError.message);
    }
  } catch (err) {
    console.warn(
      "[iPon] saveSpecSnapshot unexpected error:",
      err instanceof Error ? err.message : String(err)
    );
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
    supplier_product_id,
    raw_json,
    spec_snapshot,
    products!inner (
      id,
      category_id
    )
  `;

  let q = supabase
    .from("supplier_products")
    .select(sel)
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .is("spec_snapshot", null)
    .not("product_id", "is", null)
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(batchSize);

  if (categoryId) q = q.eq("products.category_id", categoryId);

  const { data, error } = await withPostgrestTransientRetry(
    "supplier_products.scrape-queue",
    async () => await q
  );
  if (error) throw new Error(`scrape queue: ${error.message}`);

  const rows = (data ?? []) as unknown as QueueOfferRow[];
  return rows.flatMap((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product) return [];

    return [
      {
        id: product.id,
        category_id: product.category_id,
        supplier_products: [
          {
            supplier_product_id: row.supplier_product_id,
            raw_json: row.raw_json,
            spec_snapshot: row.spec_snapshot
          }
        ]
      }
    ];
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function responseLooksLikeCaptchaChallenge(body: string, httpStatus: number): boolean {
  if (httpStatus === 429) return true;
  const head = body.slice(0, 20_000).toLowerCase();
  if (head.includes("cf-browser-verification")) return true;
  if (head.includes("cf-turnstile") || head.includes("challenges.cloudflare.com/turnstile")) return true;
  if (head.includes("captcha challenge completion required")) return true;
  if (/<title>\s*captcha\s*<\/title>/i.test(body)) return true;
  if (head.includes("checking your browser before accessing")) return true;
  if (head.includes("just a moment") && head.includes("enable javascript")) return true;
  if (head.includes("attention required") && head.includes("cloudflare")) return true;
  if (head.includes("access denied") && (head.includes("cloudflare") || head.includes("forbidden"))) return true;
  return false;
}

async function fetchIponProductRsc(
  url: string,
  jar: Map<string, string>,
  session: IponXhrSession
): Promise<{ ok: true; flight: string } | { ok: false; captcha: boolean; error?: string }> {
  try {
    const res = await fetchWithSession(url, {
      jar,
      userAgent: IPON_IMPORT_USER_AGENT,
      referer: "https://iponcomp.com/shop",
      acceptJson: false,
      acceptOverride: RSC_ACCEPT,
      acceptLanguage: IPON_ACCEPT_LANGUAGE,
      origin: "https://iponcomp.com",
      extraHeaders: { RSC: "1", ...iponXhrHeaders(session) }
    });
    const flight = await res.text();
    if (responseLooksLikeCaptchaChallenge(flight, res.status)) {
      console.log("[iPon scrape] Zaštita / challenge — zaustavljanje batch-a.");
      if (CAPTCHA_SLEEP_MS > 0) {
        console.log(`[iPon scrape] Pauza ${CAPTCHA_SLEEP_MS}ms…`);
        await sleep(CAPTCHA_SLEEP_MS);
      }
      return { ok: false, captcha: true };
    }
    if (!res.ok) return { ok: false, captcha: false, error: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes(RSC_ACCEPT)) {
      return { ok: false, captcha: false, error: `content-type ${contentType || "unknown"}` };
    }
    return { ok: true, flight };
  } catch (error) {
    return { ok: false, captcha: false, error: error instanceof Error ? error.message : String(error) };
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
  const runUntilQueueEmpty = options?.runUntilQueueEmpty ?? false;
  const dryRun = options?.dryRun ?? false;
  const batchSize = scrapeBatchSize();
  const maxDetailRequests = maxDetailRequestsForRun(batchSize);
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
    console.log(`[iPon scrape] RSC request budget: ${maxDetailRequests}`);
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let stoppedForCaptcha = false;
  let stoppedForRisk = false;
  let detailRequests = 0;
  let batches = 0;
  let xhrSession: IponXhrSession | null = null;

  if (!dryRun) {
    try {
      console.log("[iPon scrape] Sesija: /shop, pa xhr-token.");
      xhrSession = await ensureIponXhrSession(jar, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[iPon scrape] Sesija nije otvorena: ${message}`);
      if (/captcha|blokada|challenge/i.test(message)) stoppedForCaptcha = true;
      else errors += 1;
    }
  }

  for (;;) {
    if (stoppedForCaptcha || (!dryRun && !xhrSession)) break;
    batches += 1;
    if (runUntilQueueEmpty) detailRequests = 0;

    console.log(`[iPon scrape] Batch ${batches} (max ${batchSize} proizvoda)…`);

    let rows: QueueRow[];
    try {
      rows = await fetchIponScrapeQueueBatch(supabase, categoryId, batchSize);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    if (rows.length === 0) {
      console.log("[iPon scrape] Red prazan — kraj.");
      break;
    }

    for (const row of rows) {
      const offer = row.supplier_products?.[0];
      if (!offer?.supplier_product_id) {
        skipped += 1;
        continue;
      }

      const raw = offer.raw_json;
      if (!raw || typeof raw !== "object") {
        skipped += 1;
        continue;
      }

      const item = raw as IponProductItem;
      const url = getIponProductDetailUrl(item);
      const rawSpecs = specRowsFromRawJson(raw);
      if (rawSpecs.length > 0) {
        if (dryRun) {
          console.log(`[iPon scrape][dry-run] raw_json već ima specifikacije: ${url}`);
          skipped += 1;
          continue;
        }
        await saveSpecSnapshot(supabase, offer.supplier_product_id, rawSpecs, null);
        processed += 1;
        continue;
      }

      if (!isIponEnglishProductUrl(url)) {
        console.warn(`[iPon scrape] Nema engleskog URL-a, preskačem ${offer.supplier_product_id}: ${url}`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[iPon scrape][dry-run] RSC: ${url}`);
        skipped += 1;
        continue;
      }

      if (detailRequests >= maxDetailRequests) {
        console.log(`[iPon scrape] Zaustavljeno: dostignut RSC request budget (${maxDetailRequests}).`);
        stoppedForRisk = true;
        break;
      }

      console.log("RSC product:", url);
      let session: IponXhrSession;
      try {
        session = await ensureIponXhrSession(jar, xhrSession);
        xhrSession = session;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[iPon scrape] xhr-token: ${message}`);
        xhrSession = null;
        if (/captcha|blokada|challenge/i.test(message)) stoppedForCaptcha = true;
        else errors += 1;
        break;
      }
      detailRequests += 1;
      const res = await fetchIponProductRsc(url, jar, session);
      if (!res.ok) {
        if (res.captcha) {
          stoppedForCaptcha = true;
          break;
        }
        if (res.error?.startsWith("content-type")) {
          console.warn(`[iPon scrape] Nečitljiv RSC za ${url}: ${res.error}`);
          skipped += 1;
        } else {
          console.error("Fetch failed:", res.error ?? "unknown");
          errors += 1;
        }
        await sleep(productDelayMs(row.category_id));
        continue;
      }

      const parsed = parseIponRscFlight(res.flight, productIdFromIponUrl(url));
      console.log("specs:", parsed.specs.length);
      console.log("images:", parsed.images.length);
      console.log("factory_link:", parsed.manufacturerUrl ?? "(none)");

      if (parsed.specs.length === 0) {
        console.warn(`[iPon scrape] Nema specifikacija u RSC za ${url}. Snapshot se ne upisuje.`);
        skipped += 1;
        await sleep(productDelayMs(row.category_id));
        continue;
      }

      try {
        const added = await ingestIponGalleryImages(
          supabase,
          row.id,
          offer.supplier_product_id,
          parsed.images,
          raw
        );
        if (added > 0) console.log(`[iPon scrape] Galerija +${added} (${offer.supplier_product_id})`);
      } catch (galleryError) {
        console.warn(
          "[iPon scrape] Galerija:",
          galleryError instanceof Error ? galleryError.message : String(galleryError)
        );
      }

      const nameToSlug = buildAttributeSlugResolver(
        supplierAttributeMappings,
        row.category_id,
        mapSpecNameToSlug
      );
      void nameToSlug;

      await saveSpecSnapshot(supabase, offer.supplier_product_id, parsed.specs, parsed.manufacturerUrl);
      processed += 1;
      await sleep(productDelayMs(row.category_id));
    }

    if (stoppedForCaptcha) {
      console.log("[iPon scrape] Zaustavljeno zbog CAPTCHA-e.");
      break;
    }
    if (stoppedForRisk) {
      console.log("[iPon scrape] Zaustavljeno zbog request budgeta.");
      break;
    }
    if (!runUntilQueueEmpty) break;
    console.log(`[iPon scrape] Pauza između batch-eva ${BATCH_GAP_MS}ms…`);
    await sleep(BATCH_GAP_MS);
  }

  console.log(
    `[iPon scrape] Sažetak: batch-eva=${batches}, obrađeno=${processed}, grešaka=${errors}, preskočeno=${skipped}, rsc_requests=${detailRequests}, captcha_stop=${stoppedForCaptcha}, risk_stop=${stoppedForRisk}`
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
