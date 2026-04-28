/**
 * iPon: API import proizvoda (bez HTML scrapinga).
 * Poziva se više puta za sync cena i novih artikala.
 *
 * Pokretanje: npx tsx scripts/run-ipon-import-products.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { aggregatePrices } from "lib/pricing";
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
  const { data: sprows, error: sErr } = await supabase
    .from("supplier_products")
    .select("supplier_product_id, product_id")
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .in("product_id", productIds);

  if (sErr || !sprows) {
    if (sErr) console.error("[iPon] supplier_products:", sErr.message);
    return 0;
  }

  const staleIds = new Set<string>();
  for (const row of sprows) {
    if (!fetchedSupplierIds.has(row.supplier_product_id)) {
      staleIds.add(row.product_id);
    }
  }

  if (staleIds.size === 0) return 0;

  const { error: uErr } = await supabase
    .from("products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", Array.from(staleIds));

  if (uErr) {
    console.error("[iPon] deactivate:", uErr.message);
    return 0;
  }

  return staleIds.size;
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
            raw_json: item as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString()
          })
          .eq("supplier_id", IPON_SUPPLIER_ID)
          .eq("supplier_product_id", supplierProductId)
    );
    if (upSp.error) {
      throw new Error(`supplier_products update failed: ${upSp.error.message}`);
    }

    const upPr = await withPostgrestTransientRetry(
      "products.reactivate",
      async () =>
        await supabase
          .from("products")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", existing.product_id)
    );
    if (upPr.error) {
      throw new Error(`products update failed: ${upPr.error.message}`);
    }

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
        raw_json: item as unknown as Record<string, unknown>,
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
      console.log("[iPon import] Ukupno u kategoriji (API total):", rec.total);
    }

    if (items.length === 0) {
      break;
    }

    console.log("[iPon import] Stranica", page, "—", items.length, "stavki");

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
  }

  const agg = await aggregatePrices();
  console.log("[iPon import] Fixture završeno.", { imported, updated, deactivated, pricesUpdated: agg.updated });

  return {
    success: true,
    imported,
    updated,
    deactivated,
    pricesAggregated: agg.updated,
    categoriesProcessed: 1
  };
}

/**
 * API sync za sve kategorije iz `IPON_CATEGORIES` (bez HTML scrapinga).
 *
 * Ako iPon uvek vrati captcha preko Node fetch-a, privremeno snimi JSON odgovor liste u fajl i u `.env.local` dodaj:
 * `IPON_IMPORT_FIXTURE=./fixtures/ipon-list.json`
 */
export async function runIponImportProducts(
  categories: IponCategory[] = IPON_CATEGORIES
): Promise<IponImportProductsResult> {
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
    success: true,
    imported,
    updated,
    deactivated,
    pricesAggregated: agg.updated,
    categoriesProcessed: categories.length
  };
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

/** Za API rute — jedna kategorija, isti HTTP import kao `runIponImportProducts`. */
export async function importCategory(
  supplierCategoryId: number,
  internalCategoryId: string
): Promise<ImportCategoryResult> {
  const url = resolveListingUrlForSupplierGroup(supplierCategoryId);
  const cat: IponCategory = {
    name: `group-${supplierCategoryId}`,
    url,
    internalCategoryId
  };
  const supabase = createSupabaseServiceClient();
  const jar = new Map<string, string>();
  const r = await importIponCategory(supabase, cat, jar);
  const agg = await aggregatePrices();
  return {
    success: true,
    imported: r.imported,
    updated: r.updated,
    deactivated: r.deactivated,
    detailEnrichmentEnabled: false,
    pricesAggregated: agg.updated
  };
}

export { IPON_SUPPLIER_ID } from "./categories";
