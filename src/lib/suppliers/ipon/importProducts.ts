/**
 * iPon: API import proizvoda (bez HTML scrapinga).
 * Poziva se više puta za sync cena i novih artikala.
 *
 * Pokretanje: npx tsx scripts/run-ipon-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { aggregatePrices, reconcileProductsIsActiveFromSupplierOffers } from "lib/pricing";
import { mergeMatchAudit, resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { getSupplierCategories } from "lib/suppliers/registry";
import { IPON_SUPPLIER_ID, IPON_CATEGORIES, getIponSupplierGroupId, type IponCategory } from "./categories";
import {
  fetchIponProductDataPage,
  IPON_BEFORE_LIST_API_MS,
  IPON_PAGE_DELAY_MS,
  looksLikeCaptchaOrBlock,
  sleep,
  warmupIponSessionForListing
} from "./ipon-fetch";
import { processProductImages } from "./processProductImages";
import { withPostgrestTransientRetry } from "./transient-retry";
import { slugify, toSupplierProductId, type IponProductItem } from "./transformProduct";

function firstString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function pickMpn(item: IponProductItem) {
  return firstString(item.mpn) ?? firstString(item.manufacturerPartNumber) ?? firstString(item.partNumber);
}

function pickEan(item: IponProductItem) {
  return (
    firstString(item.ean) ??
    firstString(item.gtin) ??
    firstString(item.gtin13) ??
    firstString(item.barcode) ??
    firstString(item.gtin14)
  );
}

export function extractIponIdentifiers(item: IponProductItem) {
  return {
    mpn: normalizeMpn(pickMpn(item)),
    ean: normalizeEan(pickEan(item))
  };
}

async function ensureUniqueProductSlug(
  supabase: SupabaseClient,
  baseSlug: string,
  supplierProductId: string
): Promise<string> {
  const { data: existingBase } = await supabase.from("products").select("id").eq("slug", baseSlug).maybeSingle();
  if (!existingBase) return baseSlug;
  const suffix = supplierProductId.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const candidate = suffix ? `${baseSlug}-${suffix}` : `${baseSlug}-1`;
  const { data: existingCandidate } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
  if (!existingCandidate) return candidate;
  let n = 1;
  for (;;) {
    const next = `${baseSlug}-${n}`;
    const { data: taken } = await supabase.from("products").select("id").eq("slug", next).maybeSingle();
    if (!taken) return next;
    n += 1;
  }
}

/** PostgREST .in() with hundreds of UUIDs truncates/fails — chunk reads and updates. */
const SUPPLIER_PRODUCTS_IN_CHUNK = 100;

async function deactivateInactiveIponInCategory(
  supabase: SupabaseClient,
  internalCategoryId: string,
  fetchedSupplierIds: Set<string>
): Promise<number> {
  const { data: catProducts, error: cErr } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", internalCategoryId);

  if (cErr || !catProducts?.length) {
    if (cErr) console.error("[iPon] category products:", cErr.message);
    return 0;
  }

  const productIds = catProducts.map((p) => p.id);
  const sprows: Array<{ supplier_product_id: string; product_id: string }> = [];

  for (let i = 0; i < productIds.length; i += SUPPLIER_PRODUCTS_IN_CHUNK) {
    const chunk = productIds.slice(i, i + SUPPLIER_PRODUCTS_IN_CHUNK);
    const { data, error: sErr } = await supabase
      .from("supplier_products")
      .select("supplier_product_id, product_id")
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .in("product_id", chunk);

    if (sErr) {
      console.error("[iPon] supplier_products (deactivate scan):", sErr.message);
      return 0;
    }
    if (data?.length) {
      sprows.push(...(data as Array<{ supplier_product_id: string; product_id: string }>));
    }
  }

  const staleSupplierProductIds = sprows
    .filter((row) => !fetchedSupplierIds.has(String(row.supplier_product_id)))
    .map((row) => row.supplier_product_id);

  if (staleSupplierProductIds.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  let deactivated = 0;

  for (let i = 0; i < staleSupplierProductIds.length; i += SUPPLIER_PRODUCTS_IN_CHUNK) {
    const chunk = staleSupplierProductIds.slice(i, i + SUPPLIER_PRODUCTS_IN_CHUNK);
    const { error: uErr } = await supabase
      .from("supplier_products")
      .update({ is_active: false, updated_at: updatedAt })
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .in("supplier_product_id", chunk);

    if (uErr) {
      console.error("[iPon] deactivate offers:", uErr.message);
      return deactivated;
    }
    deactivated += chunk.length;
  }

  if (deactivated > 0) {
    console.log(
      `[iPon import] Deaktivirano ${deactivated} zastarjelih iPon ponuda (nema na API listi, kategorija ${internalCategoryId}).`
    );
  }

  return deactivated;
}

/** Jedan aktivan iPon offer po masteru — stari supplier_product_id ostaje ako se iPon ID promijeni. */
async function deactivateOtherIponOffersForProduct(
  supabase: SupabaseClient,
  productId: string,
  keepSupplierProductId: string
): Promise<void> {
  const { error } = await supabase
    .from("supplier_products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .eq("product_id", productId)
    .eq("is_active", true)
    .neq("supplier_product_id", keepSupplierProductId);

  if (error) {
    console.warn("[iPon] deactivateOtherIponOffersForProduct:", error.message);
  }
}

function normalizeListItem(raw: Record<string, unknown>): IponProductItem | null {
  const id = raw.id;
  if (id === undefined || id === null) return null;
  const displayName =
    (typeof raw.displayName === "string" && raw.displayName) ||
    (typeof raw.name === "string" && raw.name) ||
    (typeof raw.fullName === "string" && raw.fullName) ||
    (typeof raw.productName === "string" && raw.productName) ||
    "";
  if (!displayName) return null;

  const priceCandidates = [raw.grossPrice, raw.price, raw.listPrice, raw.netPrice];
  let gross = NaN;
  for (const p of priceCandidates) {
    if (typeof p === "number" && Number.isFinite(p)) {
      gross = p;
      break;
    }
    if (typeof p === "string" && p.trim()) {
      const n = Number(p.replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(n)) {
        gross = n;
        break;
      }
    }
  }
  if (!Number.isFinite(gross)) return null;
  return {
    ...raw,
    id,
    displayName,
    grossPrice: gross
  } as IponProductItem;
}

async function upsertIponListItem(
  supabase: SupabaseClient,
  item: IponProductItem,
  internalCategoryId: string
): Promise<"imported" | "updated"> {
  const supplierProductId = toSupplierProductId(item);

  const { data: existing, error: lookupErr } = await withPostgrestTransientRetry(
    "supplier_products.lookup",
    async () =>
      await supabase
        .from("supplier_products")
        .select("product_id")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
        .maybeSingle()
  );
  if (lookupErr) {
    throw new Error(`supplier_products lookup failed: ${lookupErr.message}`);
  }

  if (existing?.product_id) {
    const upSp = await withPostgrestTransientRetry(
      "supplier_products.update",
      async () =>
        await supabase
          .from("supplier_products")
          .update({
            price_amount: item.grossPrice,
            currency: "HUF",
            is_active: true,
            raw_json: item as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString()
          })
          .eq("supplier_id", IPON_SUPPLIER_ID)
          .eq("supplier_product_id", supplierProductId)
    );
    if (upSp.error) {
      throw new Error(`supplier_products update failed: ${upSp.error.message}`);
    }

    await deactivateOtherIponOffersForProduct(supabase, existing.product_id, supplierProductId);
    return "updated";
  }

  const { mpn: offerMpn, ean: offerEan } = extractIponIdentifiers(item);
  const match = await resolveSupplierProductMatch(supabase, { ean: offerEan, mpn: offerMpn });
  if (match.productId) {
    const { data: masterIdentifiers, error: masterIdentifiersError } = await withPostgrestTransientRetry(
      "products.identifiers-autolink",
      async () =>
        await supabase
          .from("products")
          .select("mpn, ean")
          .eq("id", match.productId)
          .maybeSingle()
    );
    if (masterIdentifiersError) {
      throw new Error(`products identifiers lookup failed: ${masterIdentifiersError.message}`);
    }
    const identifierSync = getIdentifierSyncUpdate(
      { mpn: offerMpn, ean: offerEan },
      { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
    );

    const { error: upsertLinkedError } = await withPostgrestTransientRetry(
      "supplier_products.autolink-upsert",
      async () =>
        await supabase.from("supplier_products").upsert(
          {
            supplier_id: IPON_SUPPLIER_ID,
            supplier_product_id: supplierProductId,
            product_id: match.productId,
            price_amount: item.grossPrice,
            currency: "HUF",
            is_active: true,
            mpn: identifierSync.update.mpn ?? offerMpn,
            ean: identifierSync.update.ean ?? offerEan,
            raw_json: mergeMatchAudit(item as unknown as Record<string, unknown>, match.audit),
            enrichment_status: "pending",
            master_match_status: "linked",
            updated_at: new Date().toISOString()
          },
          { onConflict: "supplier_id,supplier_product_id" }
        )
    );
    if (upsertLinkedError) {
      throw new Error(`supplier_products autolink upsert failed: ${upsertLinkedError.message}`);
    }

    await deactivateOtherIponOffersForProduct(supabase, match.productId, supplierProductId);
    return "updated";
  }

  const baseSlug = slugify(item.displayName);
  const slug = await ensureUniqueProductSlug(supabase, baseSlug, supplierProductId);
  const mainImage =
    Array.isArray(item.pictures) && item.pictures.length > 0 ? item.pictures[0] : null;

  const { data: product, error: productError } = await withPostgrestTransientRetry(
    "products.insert",
    async () =>
      await supabase
        .from("products")
        .insert({
          name: item.displayName,
          slug,
          brand: item.brand ?? null,
          description: item.description ?? null,
          main_image: mainImage,
          category_id: internalCategoryId,
          is_active: true
        })
        .select("id")
        .single()
  );

  if (productError) {
    throw new Error(`products insert failed: ${productError.message}`);
  }
  if (!product?.id) {
    throw new Error("products insert did not return id");
  }

  const { error: spError } = await withPostgrestTransientRetry(
    "supplier_products.insert",
    async () =>
      await supabase.from("supplier_products").insert({
        supplier_id: IPON_SUPPLIER_ID,
        product_id: product.id,
        supplier_product_id: supplierProductId,
        price_amount: item.grossPrice,
        currency: "HUF",
        is_active: true,
        mpn: offerMpn,
        ean: offerEan,
        raw_json: mergeMatchAudit(item as unknown as Record<string, unknown>, match.audit),
        enrichment_status: "pending",
        master_match_status: "linked"
      })
  );

  if (spError) {
    throw new Error(`supplier_products insert failed: ${spError.message}`);
  }

  const pictureUrls = Array.isArray(item.pictures) ? item.pictures.filter((u): u is string => typeof u === "string") : [];
  if (pictureUrls.length > 0) {
    await processProductImages(supabase, product.id, pictureUrls);
    const { data: firstImage } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstImage?.image_url) {
      await supabase.from("products").update({ main_image: firstImage.image_url }).eq("id", product.id);
    }
  }

  return "imported";
}

async function upsertItemsForCategory(
  supabase: SupabaseClient,
  cat: IponCategory,
  rawItems: unknown[]
): Promise<{ imported: number; updated: number; fetchedIds: Set<string> }> {
  const fetchedIds = new Set<string>();
  let imported = 0;
  let updated = 0;
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = normalizeListItem(raw as Record<string, unknown>);
    if (!item) continue;
    fetchedIds.add(toSupplierProductId(item));
    const r = await upsertIponListItem(supabase, item, cat.internalCategoryId);
    if (r === "imported") imported += 1;
    else updated += 1;
  }
  return { imported, updated, fetchedIds };
}

async function importIponCategory(
  supabase: SupabaseClient,
  cat: IponCategory,
  jar: Map<string, string>
): Promise<{ imported: number; updated: number; deactivated: number }> {
  const groupId = getIponSupplierGroupId(cat);

  console.log("[iPon import] Warmup sesije:", cat.name, cat.url);
  await warmupIponSessionForListing(jar, cat.url);
  await sleep(IPON_BEFORE_LIST_API_MS);

  const fetchedIds = new Set<string>();
  let imported = 0;
  let updated = 0;
  let page = 1;
  let apiTotal: number | null = null;
  let skippedUnparseable = 0;

  for (;;) {
    const res = await fetchIponProductDataPage(jar, cat.url, groupId, page);

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Lista proizvoda HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      console.error("[iPon import] Lista — početak odgovora (debug):", text.slice(0, 280).replace(/\s+/g, " "));
      if (looksLikeCaptchaOrBlock(text, res.status)) {
        throw new Error(
          "iPon lista: captcha / blokada (odgovor nije JSON). Ništa nije upisano u Supabase. " +
            "Probaj sa svog PC-a van VPN-a, ili snimi JSON iz DevTools (Network → product/data) u fajl i postavi IPON_IMPORT_FIXTURE u .env.local."
        );
      }
      throw new Error(`Odgovor liste nije JSON: ${text.slice(0, 200)}`);
    }

    const rec = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
    const rawItems = Array.isArray(json) ? json : rec?.items ?? rec?.data ?? rec?.products;
    const items = Array.isArray(rawItems) ? rawItems : [];

    if (page === 1 && rec && typeof rec.total === "number") {
      apiTotal = rec.total;
      console.log("[iPon import] Ukupno u kategoriji (API total):", apiTotal);
    }

    if (items.length === 0) {
      break;
    }

    console.log("[iPon import] Stranica", page, "—", items.length, "stavki");

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      if (!normalizeListItem(raw as Record<string, unknown>)) skippedUnparseable += 1;
    }

    const batch = await upsertItemsForCategory(supabase, cat, items);
    imported += batch.imported;
    updated += batch.updated;
    batch.fetchedIds.forEach((id) => fetchedIds.add(id));

    page += 1;
    await sleep(IPON_PAGE_DELAY_MS);
  }

  let deactivated = 0;
  if (fetchedIds.size === 0) {
    console.warn("[iPon import] Nema artikala u odgovoru — preskačem deaktivaciju za", cat.name);
  } else {
    deactivated = await deactivateInactiveIponInCategory(supabase, cat.internalCategoryId, fetchedIds);
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) {
      console.warn("[iPon] reconcile_products_is_active_from_supplier_offers:", rec.error);
    }
  }

  console.log(
    `[iPon import] Sažetak ${cat.name}: API total=${apiTotal ?? "?"}, fetchedIds=${fetchedIds.size}, preskočeno (bez cijene)=${skippedUnparseable}, deaktivirano=${deactivated}`
  );
  if (apiTotal != null && fetchedIds.size !== apiTotal) {
    console.warn(
      `[iPon import] fetchedIds (${fetchedIds.size}) ≠ API total (${apiTotal}) — razlika je obično stavke bez cijene ili dupli ID na listi.`
    );
  }

  return { imported, updated, deactivated };
}

export type IponImportProductsResult = {
  success: boolean;
  imported: number;
  updated: number;
  deactivated: number;
  pricesAggregated: number;
  categoriesProcessed: number;
  summary?: {
    imported: number;
    updated: number;
    deactivated_offers: number;
    prices_aggregated: number;
    aggregate_batches: number;
    categories_processed: number;
    single_category?: boolean;
    category_name?: string;
    internal_category_id?: string;
    aggregate_error?: string;
    aggregate_warnings?: string[];
  };
};

/**
 * Uvezi jednu stranicu liste iz snimljenog JSON odgovora (DevTools → Network → product/data → Save).
 * U `.env.local`: IPON_IMPORT_FIXTURE=./fixtures/ipon-product-data-page1.json
 */
export async function runIponImportFromFixtureFile(
  filePath: string,
  categories: IponCategory[] = IPON_CATEGORIES
): Promise<IponImportProductsResult> {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(filePath, "utf8");
  const json = JSON.parse(text) as unknown;
  const rec = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  const rawItems = Array.isArray(json) ? json : rec?.items ?? rec?.data ?? rec?.products;
  if (!Array.isArray(rawItems)) {
    throw new Error("Fixture: očekujem telo kao { items: [...] } ili niz objekata sa iPon liste.");
  }

  const supabase = createSupabaseServiceClient();
  const cat = categories[0];
  if (!cat) throw new Error("IPON_CATEGORIES je prazan.");

  console.log("[iPon import] Fixture:", filePath, "stavki:", rawItems.length, "→ kategorija:", cat.name);

  const { imported, updated, fetchedIds } = await upsertItemsForCategory(supabase, cat, rawItems);

  let deactivated = 0;
  if (fetchedIds.size > 0) {
    deactivated = await deactivateInactiveIponInCategory(supabase, cat.internalCategoryId, fetchedIds);
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) {
      console.warn("[iPon] reconcile_products_is_active_from_supplier_offers:", rec.error);
    }
  }

  const agg = await aggregatePrices();
  console.log("[iPon import] Fixture završeno.", { imported, updated, deactivated, pricesUpdated: agg.updated });

  return {
    success: !agg.error,
    imported,
    updated,
    deactivated,
    pricesAggregated: agg.updated,
    categoriesProcessed: 1,
    summary: {
      imported,
      updated,
      deactivated_offers: deactivated,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      categories_processed: 1,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };
}

/**
 * API sync za sve kategorije iz `IPON_CATEGORIES` (bez HTML scrapinga).
 *
 * Ako iPon uvek vrati captcha preko Node fetch-a, privremeno snimi JSON odgovor liste u fajl i u `.env.local` dodaj:
 * `IPON_IMPORT_FIXTURE=./fixtures/ipon-list.json`
 */
export async function runIponImportProducts(
  categoriesOverride?: IponCategory[]
): Promise<IponImportProductsResult> {
  const categories = categoriesOverride ?? (await resolveIponCategoriesFromRegistry());
  const fixture = process.env.IPON_IMPORT_FIXTURE?.trim();
  if (fixture) {
    return runIponImportFromFixtureFile(fixture, categories);
  }

  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();

  let imported = 0;
  let updated = 0;
  let deactivated = 0;

  for (const cat of categories) {
    const r = await importIponCategory(supabase, cat, jar);
    imported += r.imported;
    updated += r.updated;
    deactivated += r.deactivated;
  }

  const agg = await aggregatePrices();

  console.log("[iPon import] Završeno.", {
    imported,
    updated,
    deactivated,
    pricesUpdated: agg.updated,
    categories: categories.length
  });

  return {
    success: !agg.error,
    imported,
    updated,
    deactivated,
    pricesAggregated: agg.updated,
    categoriesProcessed: categories.length,
    summary: {
      imported,
      updated,
      deactivated_offers: deactivated,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      categories_processed: categories.length,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };
}

/**
 * Učitava listu iPon kategorija iz `supplier_categories` (DB-first). Ako je tabela
 * prazna ili nedostupna, registry vraća `IPON_CATEGORIES` kao fallback — ponašanje
 * je identično postojećem hardcoded toku.
 */
async function resolveIponCategoriesFromRegistry(): Promise<IponCategory[]> {
  const rows = await getSupplierCategories(IPON_SUPPLIER_ID);
  if (rows.length === 0) return IPON_CATEGORIES;

  const result: IponCategory[] = [];
  for (const row of rows) {
    const supplierCategoryId = row.supplierCategoryKey ? Number.parseInt(row.supplierCategoryKey, 10) : NaN;
    const fallback = IPON_CATEGORIES.find((c) => c.internalCategoryId === row.internalCategoryId);
    const url = row.listingUrl ?? fallback?.url;
    if (!url) continue;
    result.push({
      name: fallback?.name ?? `category-${row.internalCategoryId.slice(0, 8)}`,
      url,
      internalCategoryId: row.internalCategoryId,
      supplierCategoryId: Number.isFinite(supplierCategoryId) ? supplierCategoryId : fallback?.supplierCategoryId
    });
  }
  return result.length > 0 ? result : IPON_CATEGORIES;
}

export type ImportCategoryResult = {
  success: boolean;
  imported: number;
  updated: number;
  deactivated: number;
  /** Uvek false — detalji idu preko `scrapeDetails.ts`. */
  detailEnrichmentEnabled: boolean;
  pricesAggregated?: number;
};

function resolveListingUrlForSupplierGroup(supplierCategoryId: number): string {
  const hit = IPON_CATEGORIES.find((c) => getIponSupplierGroupId(c) === supplierCategoryId);
  return hit?.url ?? `https://iponcomp.com/shop/group/${supplierCategoryId}`;
}

export type SupplierCategoryImportInput = {
  internalCategoryId: string;
  listingUrl: string;
  supplierCategoryKey?: string | null;
  /** Label za log / job summary (npr. ime interne kategorije). */
  name?: string;
};

/** Gradi `IponCategory` iz reda `supplier_categories` (admin supplier UI). */
export function buildIponCategoryFromSupplierRow(input: SupplierCategoryImportInput): IponCategory {
  const url = input.listingUrl.trim();
  if (!url) {
    throw new Error("Listing URL je obavezan za iPon import ove kategorije.");
  }
  let supplierCategoryId: number | undefined;
  const key = input.supplierCategoryKey?.trim();
  if (key) {
    const n = Number.parseInt(key, 10);
    if (Number.isFinite(n)) supplierCategoryId = n;
  }
  return {
    name: input.name ?? `category-${input.internalCategoryId.slice(0, 8)}`,
    url,
    internalCategoryId: input.internalCategoryId,
    supplierCategoryId
  };
}

/**
 * Ručni import jedne kategorije (jedan red supplier_categories).
 * Ne mijenja ponašanje `runIponImportProducts` (pun sync svih aktivnih redova).
 */
export async function runIponImportForSupplierCategory(
  input: SupplierCategoryImportInput
): Promise<IponImportProductsResult> {
  const cat = buildIponCategoryFromSupplierRow(input);
  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();
  const r = await importIponCategory(supabase, cat, jar);
  const agg = await aggregatePrices();

  console.log("[iPon import] Jedna kategorija završena.", {
    category: cat.name,
    imported: r.imported,
    updated: r.updated,
    deactivated: r.deactivated,
    pricesUpdated: agg.updated
  });

  return {
    success: !agg.error,
    imported: r.imported,
    updated: r.updated,
    deactivated: r.deactivated,
    pricesAggregated: agg.updated,
    categoriesProcessed: 1,
    summary: {
      imported: r.imported,
      updated: r.updated,
      deactivated_offers: r.deactivated,
      prices_aggregated: agg.updated,
      aggregate_batches: agg.batches,
      categories_processed: 1,
      single_category: true,
      category_name: cat.name,
      internal_category_id: cat.internalCategoryId,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {})
    }
  };
}

/** Za API rute — jedna kategorija, isti HTTP import kao `runIponImportProducts`. */
export async function importCategory(
  supplierCategoryId: number,
  internalCategoryId: string
): Promise<ImportCategoryResult> {
  const url = resolveListingUrlForSupplierGroup(supplierCategoryId);
  const result = await runIponImportForSupplierCategory({
    internalCategoryId,
    listingUrl: url,
    supplierCategoryKey: String(supplierCategoryId),
    name: `group-${supplierCategoryId}`
  });
  return {
    success: result.success,
    imported: result.imported,
    updated: result.updated,
    deactivated: result.deactivated,
    detailEnrichmentEnabled: false,
    pricesAggregated: result.pricesAggregated
  };
}

export { IPON_SUPPLIER_ID } from "./categories";
