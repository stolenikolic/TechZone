/**
 * iPon: API import proizvoda (discovery mod — novi artikli, detekcija slike).
 * Discovery: globalni preload indeksa, brzi skip postojećih, paralelno N novih artikala.
 * Cijene i deaktivacija: `xmlSync.ts` (XML feed, cron svakih 2h).
 *
 * Pokretanje: npx tsx scripts/run-ipon-import-products.ts
 * Cijene: npx tsx scripts/run-ipon-xml-sync.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  aggregatePrices,
  aggregatePricesForProductIds,
  reconcileProductsIsActiveFromSupplierOffers
} from "lib/pricing";
import { mergeMatchAudit, resolveSupplierProductMatchSafe } from "lib/suppliers/matchSupplierProduct";
import { normalizeEan, normalizeMpn, mpnMatchKeyFromMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { getSupplierCategories } from "lib/suppliers/registry";
import { IPON_SUPPLIER_ID, IPON_CATEGORIES, getIponSupplierGroupId, type IponCategory } from "./categories";
import {
  fetchIponProductDataPage,
  IPON_BEFORE_LIST_API_MS,
  IPON_PAGE_DELAY_MS,
  isIponDiscoveryImportMode,
  listingUrlHasFilterParams,
  looksLikeCaptchaOrBlock,
  numEnv,
  sleep,
  warmupIponSessionForListing
} from "./ipon-fetch";
import { processProductImages } from "./processProductImages";
import {
  getFirstPictureUrl,
  needsPicturesIngest,
  PICTURES_INGESTED_FROM_KEY,
  reingestIponProductImages
} from "./ipon-product-images";
import { withPostgrestTransientRetry } from "./transient-retry";
import {
  parseIponDeliveryDays,
  parseIponWarrantyMonths,
  slugify,
  toSupplierProductId,
  type IponProductItem
} from "./transformProduct";

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

const OFFER_INDEX_PAGE_SIZE = Math.min(numEnv("IPON_IMPORT_DB_PAGE_SIZE", 1000), 1000);
const IMPORT_CONCURRENCY = numEnv("IPON_IMPORT_CONCURRENCY", 3);
const IMAGE_RETRY_ATTEMPTS = 3;
const IMAGE_RETRY_DELAY_MS = 500;

export type IponOfferIndexEntry = {
  productId: string;
  rawJson: unknown;
};

export type IponOfferIndex = Map<string, IponOfferIndexEntry>;

type OfferSnapshot = { price_amount: number | null; is_active: boolean | null };

type UpsertIponListItemContext = {
  offerIndex?: IponOfferIndex;
  existingEntry?: IponOfferIndexEntry;
};

type UpsertIponListItemResult =
  | { outcome: "imported"; productId: string }
  | {
      outcome: "succeeded";
      priceChanged: boolean;
      activated: boolean;
      imageChanged?: boolean;
      rescrapeQueued?: boolean;
    };

type DiscoveryPriceAggregateResult = {
  pricesAggregated: number;
  aggregateBatches: number;
  aggError?: string;
  aggWarnings?: string[];
};

async function aggregateDiscoveryNewProductPrices(
  discoveryMode: boolean,
  newProductIds: string[]
): Promise<DiscoveryPriceAggregateResult> {
  if (!discoveryMode || newProductIds.length === 0) {
    return { pricesAggregated: 0, aggregateBatches: 0 };
  }

  const uniqueIds = Array.from(new Set(newProductIds));
  console.log(`[iPon import] Agregacija cijena za ${uniqueIds.length} novih proizvoda…`);
  const agg = await aggregatePricesForProductIds(uniqueIds);
  if (agg.error) {
    console.warn("[iPon import] aggregatePricesForProductIds:", agg.error);
  }

  return {
    pricesAggregated: agg.updated,
    aggregateBatches: agg.batches,
    aggError: agg.error,
    aggWarnings: agg.warnings
  };
}

/** Jednom na početku discovery importa — svi iPon supplier_product_id za brzi skip. */
export async function fetchAllIponOfferIndex(supabase: SupabaseClient): Promise<IponOfferIndex> {
  const index: IponOfferIndex = new Map();
  let offset = 0;
  let pageNum = 0;

  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("import.fetchOfferIndex", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id, product_id, raw_json")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .not("product_id", "is", null)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + OFFER_INDEX_PAGE_SIZE - 1)
    );

    if (error) throw new Error(`import fetch offer index: ${error.message}`);
    const page = (data ?? []) as Array<{
      supplier_product_id: string;
      product_id: string;
      raw_json: unknown;
    }>;
    if (page.length === 0) break;

    pageNum += 1;
    for (const row of page) {
      if (!row.product_id) continue;
      index.set(String(row.supplier_product_id), {
        productId: String(row.product_id),
        rawJson: row.raw_json
      });
    }
    offset += page.length;

    if (pageNum === 1 || pageNum % 5 === 0 || page.length < OFFER_INDEX_PAGE_SIZE) {
      console.log(`[iPon import] Preload indeks: ${index.size} ponuda (stranica ${pageNum})`);
    }

    if (page.length < OFFER_INDEX_PAGE_SIZE) break;
  }

  return index;
}

function discoveryExistingUnchanged(entry: IponOfferIndexEntry, item: IponProductItem): boolean {
  const newPic = getFirstPictureUrlFromItem(item);
  const rawRecord =
    entry.rawJson && typeof entry.rawJson === "object" ? (entry.rawJson as Record<string, unknown>) : null;
  const oldPic = getFirstPictureUrlFromItem(rawRecord as IponProductItem | null);
  const urlChanged = Boolean(newPic && oldPic && newPic !== oldPic);
  if (urlChanged) return false;
  const ingestPending = needsPicturesIngest(rawRecord, newPic);
  return !(ingestPending && newPic);
}

function setOfferIndexEntry(
  offerIndex: IponOfferIndex | undefined,
  supplierProductId: string,
  entry: IponOfferIndexEntry
): void {
  offerIndex?.set(supplierProductId, entry);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = idx;
      idx += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function processProductImagesWithRetry(
  supabase: SupabaseClient,
  productId: string,
  pictureUrls: string[]
): Promise<string[]> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= IMAGE_RETRY_ATTEMPTS; attempt++) {
    try {
      const urls = await processProductImages(supabase, productId, pictureUrls);
      if (urls.length > 0) return urls;
    } catch (err) {
      lastErr = err;
    }
    if (attempt < IMAGE_RETRY_ATTEMPTS) {
      await sleep(IMAGE_RETRY_DELAY_MS);
    }
  }

  if (lastErr) {
    console.warn(`[iPon import] Slike product ${productId} nakon ${IMAGE_RETRY_ATTEMPTS} pokušaja:`, lastErr);
  }
  return [];
}

async function applyNewProductImages(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  pictureUrls: string[],
  baseRaw: Record<string, unknown>,
  offerIndex?: IponOfferIndex
): Promise<void> {
  if (pictureUrls.length === 0) return;

  const hostedUrls = await processProductImagesWithRetry(supabase, productId, pictureUrls);
  if (hostedUrls.length === 0) {
    console.warn(
      `[iPon import] Slike nisu učitane za ${supplierProductId} — artikal ostaje bez hosted slika (repair job).`
    );
    return;
  }

  const mainImage = hostedUrls[0];
  if (mainImage) {
    await supabase.from("products").update({ main_image: mainImage }).eq("id", productId);
  }

  if (pictureUrls[0]) {
    const mergedRaw = { ...baseRaw, [PICTURES_INGESTED_FROM_KEY]: pictureUrls[0] };
    await supabase
      .from("supplier_products")
      .update({
        raw_json: mergedRaw,
        updated_at: new Date().toISOString()
      })
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .eq("supplier_product_id", supplierProductId);
    setOfferIndexEntry(offerIndex, supplierProductId, {
      productId,
      rawJson: mergedRaw
    });
  }
}

function getFirstPictureUrlFromItem(item: IponProductItem | Record<string, unknown> | null | undefined): string | null {
  return getFirstPictureUrl(item);
}

async function queueRescrapeAfterImageChange(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  item: IponProductItem,
  existingRaw: Record<string, unknown> | null
): Promise<void> {
  const mergedRaw: Record<string, unknown> = {
    ...(existingRaw ?? {}),
    ...(item as unknown as Record<string, unknown>),
    pictures: item.pictures
  };

  const pictureUrls = Array.isArray(item.pictures)
    ? item.pictures.filter((u): u is string => typeof u === "string")
    : [];
  if (pictureUrls[0]) {
    mergedRaw[PICTURES_INGESTED_FROM_KEY] = pictureUrls[0];
  }

  const { error: spErr } = await withPostgrestTransientRetry(
    "supplier_products.rescrape-reset",
    async () =>
      await supabase
        .from("supplier_products")
        .update({
          raw_json: mergedRaw,
          spec_snapshot: null,
          specs_fetched_at: null,
          enrichment_status: "pending",
          updated_at: new Date().toISOString()
        })
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
  );
  if (spErr) {
    throw new Error(`supplier_products rescrape reset failed: ${spErr.message}`);
  }

  if (pictureUrls.length > 0) {
    await reingestIponProductImages(supabase, productId, pictureUrls, {
      supplierProductId,
      existingRaw: mergedRaw,
      updateIngestedMarker: false
    });
  }

  const { data: productRow } = await supabase
    .from("products")
    .select("ai_description_locked")
    .eq("id", productId)
    .maybeSingle();

  if (!productRow?.ai_description_locked) {
    await supabase
      .from("products")
      .update({ ai_description_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", productId);
  }
}

async function handleDiscoveryExistingOffer(
  supabase: SupabaseClient,
  productId: string,
  supplierProductId: string,
  item: IponProductItem,
  existingRaw: unknown,
  offerIndex?: IponOfferIndex
): Promise<UpsertIponListItemResult> {
  const rawRecord =
    existingRaw && typeof existingRaw === "object" ? (existingRaw as Record<string, unknown>) : null;
  const newPic = getFirstPictureUrlFromItem(item);
  const oldPic = getFirstPictureUrlFromItem(rawRecord as IponProductItem | null);
  const urlChanged = Boolean(newPic && oldPic && newPic !== oldPic);
  const ingestPending = needsPicturesIngest(rawRecord, newPic);

  if (urlChanged) {
    await queueRescrapeAfterImageChange(supabase, productId, supplierProductId, item, rawRecord);
    await deactivateOtherIponOffersForProduct(supabase, productId, supplierProductId);
    const mergedRaw: Record<string, unknown> = {
      ...(rawRecord ?? {}),
      ...(item as unknown as Record<string, unknown>),
      pictures: item.pictures
    };
    setOfferIndexEntry(offerIndex, supplierProductId, { productId, rawJson: mergedRaw });
    return {
      outcome: "succeeded",
      priceChanged: false,
      activated: false,
      imageChanged: true,
      rescrapeQueued: true
    };
  }

  if (ingestPending && newPic) {
    const pictureUrls = Array.isArray(item.pictures)
      ? item.pictures.filter((u): u is string => typeof u === "string")
      : [newPic];
    await reingestIponProductImages(supabase, productId, pictureUrls, {
      supplierProductId,
      existingRaw: rawRecord
    });
    await deactivateOtherIponOffersForProduct(supabase, productId, supplierProductId);
    const mergedRaw: Record<string, unknown> = {
      ...(rawRecord ?? {}),
      [PICTURES_INGESTED_FROM_KEY]: pictureUrls[0]
    };
    setOfferIndexEntry(offerIndex, supplierProductId, { productId, rawJson: mergedRaw });
    return {
      outcome: "succeeded",
      priceChanged: false,
      activated: false,
      imageChanged: true,
      rescrapeQueued: false
    };
  }

  return { outcome: "succeeded", priceChanged: false, activated: false, imageChanged: false, rescrapeQueued: false };
}

function iponOfferPriceChanged(before: OfferSnapshot | null | undefined, grossPrice: number): boolean {
  if (!before) return false;
  const prev = before.price_amount != null ? Number(before.price_amount) : NaN;
  return !Number.isFinite(prev) || prev !== grossPrice;
}

function iponOfferActivated(before: OfferSnapshot | null | undefined): boolean {
  if (!before) return false;
  return before.is_active === false;
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
  const sprows: Array<{
    supplier_product_id: string;
    product_id: string;
    is_active: boolean;
  }> = [];

  for (let i = 0; i < productIds.length; i += SUPPLIER_PRODUCTS_IN_CHUNK) {
    const chunk = productIds.slice(i, i + SUPPLIER_PRODUCTS_IN_CHUNK);
    const { data, error: sErr } = await supabase
      .from("supplier_products")
      .select("supplier_product_id, product_id, is_active")
      .eq("supplier_id", IPON_SUPPLIER_ID)
      .in("product_id", chunk);

    if (sErr) {
      console.error("[iPon] supplier_products (deactivate scan):", sErr.message);
      return 0;
    }
    if (data?.length) {
      sprows.push(
        ...(data as Array<{
          supplier_product_id: string;
          product_id: string;
          is_active: boolean;
        }>)
      );
    }
  }

  const staleSupplierProductIds = sprows
    .filter(
      (row) =>
        row.is_active === true && !fetchedSupplierIds.has(String(row.supplier_product_id))
    )
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
      `[iPon import] Deaktivirano ${deactivated} iPon ponuda (active → inactive, nema na API listi, kategorija ${internalCategoryId}).`
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

async function insertOrLinkIponListItem(
  supabase: SupabaseClient,
  item: IponProductItem,
  internalCategoryId: string,
  ctx?: UpsertIponListItemContext
): Promise<UpsertIponListItemResult> {
  const supplierProductId = toSupplierProductId(item);
  const discoveryMode = isIponDiscoveryImportMode();
  const offerIndex = ctx?.offerIndex;

  const { mpn: offerMpn, ean: offerEan } = extractIponIdentifiers(item);
  const match = await resolveSupplierProductMatchSafe(supabase, { ean: offerEan, mpn: offerMpn });
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

    let linkedOfferBefore: OfferSnapshot | null = null;
    if (!discoveryMode || !offerIndex) {
      const { data, error: linkedOfferLookupError } = await withPostgrestTransientRetry(
        "supplier_products.autolink-lookup",
        async () =>
          await supabase
            .from("supplier_products")
            .select("price_amount, is_active")
            .eq("supplier_id", IPON_SUPPLIER_ID)
            .eq("supplier_product_id", supplierProductId)
            .maybeSingle()
      );
      if (linkedOfferLookupError) {
        throw new Error(`supplier_products autolink lookup failed: ${linkedOfferLookupError.message}`);
      }
      linkedOfferBefore = data;
    }

    const priceChanged = discoveryMode ? false : iponOfferPriceChanged(linkedOfferBefore, item.grossPrice);
    const activated = iponOfferActivated(linkedOfferBefore);
    const linkedRaw = mergeMatchAudit(item as unknown as Record<string, unknown>, match.audit);

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
            delivery_days: parseIponDeliveryDays(item),
            warranty_months: parseIponWarrantyMonths(item),
            mpn: identifierSync.update.mpn ?? offerMpn,
            mpn_match_key: mpnMatchKeyFromMpn(identifierSync.update.mpn ?? offerMpn),
            ean: identifierSync.update.ean ?? offerEan,
            raw_json: linkedRaw,
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

    setOfferIndexEntry(offerIndex, supplierProductId, {
      productId: match.productId,
      rawJson: linkedRaw
    });

    await deactivateOtherIponOffersForProduct(supabase, match.productId, supplierProductId);
    return { outcome: "succeeded", priceChanged, activated };
  }

  const baseSlug = slugify(item.displayName);
  const slug = await ensureUniqueProductSlug(supabase, baseSlug, supplierProductId);
  const mainImage =
    Array.isArray(item.pictures) && item.pictures.length > 0 ? item.pictures[0] : null;
  const baseRaw = mergeMatchAudit(item as unknown as Record<string, unknown>, match.audit);

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
        delivery_days: parseIponDeliveryDays(item),
        warranty_months: parseIponWarrantyMonths(item),
        mpn: offerMpn,
        mpn_match_key: mpnMatchKeyFromMpn(offerMpn),
        ean: offerEan,
        raw_json: baseRaw,
        enrichment_status: "pending",
        master_match_status: "linked"
      })
  );

  if (spError) {
    throw new Error(`supplier_products insert failed: ${spError.message}`);
  }

  setOfferIndexEntry(offerIndex, supplierProductId, {
    productId: product.id,
    rawJson: baseRaw
  });

  const pictureUrls = Array.isArray(item.pictures) ? item.pictures.filter((u): u is string => typeof u === "string") : [];
  await applyNewProductImages(supabase, product.id, supplierProductId, pictureUrls, baseRaw, offerIndex);

  return { outcome: "imported", productId: product.id };
}

async function upsertIponListItem(
  supabase: SupabaseClient,
  item: IponProductItem,
  internalCategoryId: string,
  ctx?: UpsertIponListItemContext
): Promise<UpsertIponListItemResult> {
  const supplierProductId = toSupplierProductId(item);
  const discoveryMode = isIponDiscoveryImportMode();
  const offerIndex = ctx?.offerIndex;
  const existingEntry = ctx?.existingEntry;

  if (discoveryMode && existingEntry) {
    return handleDiscoveryExistingOffer(
      supabase,
      existingEntry.productId,
      supplierProductId,
      item,
      existingEntry.rawJson,
      offerIndex
    );
  }

  if (discoveryMode && offerIndex && !existingEntry) {
    return insertOrLinkIponListItem(supabase, item, internalCategoryId, ctx);
  }

  const { data: existing, error: lookupErr } = await withPostgrestTransientRetry(
    "supplier_products.lookup",
    async () =>
      await supabase
        .from("supplier_products")
        .select("product_id, price_amount, is_active, raw_json")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .eq("supplier_product_id", supplierProductId)
        .maybeSingle()
  );
  if (lookupErr) {
    throw new Error(`supplier_products lookup failed: ${lookupErr.message}`);
  }

  if (existing?.product_id) {
    if (discoveryMode) {
      return handleDiscoveryExistingOffer(
        supabase,
        existing.product_id,
        supplierProductId,
        item,
        existing.raw_json,
        offerIndex
      );
    }

    const priceChanged = iponOfferPriceChanged(existing, item.grossPrice);
    const activated = iponOfferActivated(existing);
    const upSp = await withPostgrestTransientRetry(
      "supplier_products.update",
      async () =>
        await supabase
          .from("supplier_products")
          .update({
            price_amount: item.grossPrice,
            currency: "HUF",
            is_active: true,
            delivery_days: parseIponDeliveryDays(item),
            warranty_months: parseIponWarrantyMonths(item),
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
    return { outcome: "succeeded", priceChanged, activated };
  }

  return insertOrLinkIponListItem(supabase, item, internalCategoryId, ctx);
}

function accumulateUpsertResult(
  r: UpsertIponListItemResult,
  tallies: {
    imported: number;
    succeeded: number;
    updated: number;
    activated: number;
    imageChanged: number;
    rescrapeQueued: number;
    newProductIds: string[];
  }
): void {
  if (r.outcome === "imported") {
    tallies.imported += 1;
    tallies.newProductIds.push(r.productId);
  } else {
    tallies.succeeded += 1;
    if (r.priceChanged) tallies.updated += 1;
    if (r.activated) tallies.activated += 1;
    if (r.imageChanged) tallies.imageChanged += 1;
    if (r.rescrapeQueued) tallies.rescrapeQueued += 1;
  }
}

type DiscoveryUpsertTask = {
  item: IponProductItem;
  existingEntry?: IponOfferIndexEntry;
};

async function upsertItemsForCategory(
  supabase: SupabaseClient,
  cat: IponCategory,
  rawItems: unknown[],
  options?: { offerIndex?: IponOfferIndex; discoveryMode?: boolean }
): Promise<{
  imported: number;
  succeeded: number;
  updated: number;
  activated: number;
  imageChanged: number;
  rescrapeQueued: number;
  skippedUnchanged: number;
  fetchedIds: Set<string>;
  newProductIds: string[];
}> {
  const fetchedIds = new Set<string>();
  const newProductIds: string[] = [];
  const tallies = {
    imported: 0,
    succeeded: 0,
    updated: 0,
    activated: 0,
    imageChanged: 0,
    rescrapeQueued: 0,
    newProductIds
  };
  let skippedUnchanged = 0;

  const discoveryMode = options?.discoveryMode ?? isIponDiscoveryImportMode();
  const offerIndex = options?.offerIndex;
  const useFastPath = discoveryMode && offerIndex;

  if (useFastPath) {
    const parallelTasks: DiscoveryUpsertTask[] = [];

    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue;
      const item = normalizeListItem(raw as Record<string, unknown>);
      if (!item) continue;

      const supplierProductId = toSupplierProductId(item);
      fetchedIds.add(supplierProductId);

      const existingEntry = offerIndex.get(supplierProductId);
      if (existingEntry && discoveryExistingUnchanged(existingEntry, item)) {
        skippedUnchanged += 1;
        continue;
      }

      parallelTasks.push({ item, existingEntry });
    }

    if (parallelTasks.length > 0) {
      const results = await runWithConcurrency(parallelTasks, IMPORT_CONCURRENCY, async (task) =>
        upsertIponListItem(supabase, task.item, cat.internalCategoryId, {
          offerIndex,
          existingEntry: task.existingEntry
        })
      );
      for (const r of results) {
        accumulateUpsertResult(r, tallies);
      }
    }
  } else {
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue;
      const item = normalizeListItem(raw as Record<string, unknown>);
      if (!item) continue;
      fetchedIds.add(toSupplierProductId(item));
      const r = await upsertIponListItem(supabase, item, cat.internalCategoryId, { offerIndex });
      accumulateUpsertResult(r, tallies);
    }
  }

  return {
    imported: tallies.imported,
    succeeded: tallies.succeeded,
    updated: tallies.updated,
    activated: tallies.activated,
    imageChanged: tallies.imageChanged,
    rescrapeQueued: tallies.rescrapeQueued,
    skippedUnchanged,
    fetchedIds,
    newProductIds: tallies.newProductIds
  };
}

async function importIponCategory(
  supabase: SupabaseClient,
  cat: IponCategory,
  jar: Map<string, string>,
  options?: { skipWarmup?: boolean; offerIndex?: IponOfferIndex; discoveryMode?: boolean }
): Promise<{
  imported: number;
  succeeded: number;
  updated: number;
  activated: number;
  imageChanged: number;
  rescrapeQueued: number;
  skippedUnchanged: number;
  deactivated: number;
  newProductIds: string[];
}> {
  const groupId = getIponSupplierGroupId(cat);

  if (!options?.skipWarmup) {
    console.log("[iPon import] Warmup sesije:", cat.name, cat.url);
    await warmupIponSessionForListing(jar, cat.url);
    await sleep(IPON_BEFORE_LIST_API_MS);
  }

  const fetchedIds = new Set<string>();
  let imported = 0;
  let succeeded = 0;
  let updated = 0;
  let activated = 0;
  let imageChanged = 0;
  let rescrapeQueued = 0;
  let skippedUnchanged = 0;
  const newProductIds: string[] = [];
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

    const batch = await upsertItemsForCategory(supabase, cat, items, {
      offerIndex: options?.offerIndex,
      discoveryMode: options?.discoveryMode
    });
    imported += batch.imported;
    succeeded += batch.succeeded;
    updated += batch.updated;
    activated += batch.activated;
    imageChanged += batch.imageChanged;
    rescrapeQueued += batch.rescrapeQueued;
    skippedUnchanged += batch.skippedUnchanged;
    batch.fetchedIds.forEach((id) => fetchedIds.add(id));
    newProductIds.push(...batch.newProductIds);

    page += 1;
    await sleep(IPON_PAGE_DELAY_MS);
  }

  let deactivated = 0;
  if (fetchedIds.size === 0) {
    console.warn("[iPon import] Nema artikala u odgovoru — preskačem deaktivaciju za", cat.name);
  } else if (listingUrlHasFilterParams(cat.url)) {
    console.log(
      "[iPon import] Filtrirani listing URL — preskačem deaktivaciju (podskup kategorije):",
      cat.name
    );
  } else {
    deactivated = await deactivateInactiveIponInCategory(supabase, cat.internalCategoryId, fetchedIds);
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) {
      console.warn("[iPon] reconcile_products_is_active_from_supplier_offers:", rec.error);
    }
  }

  console.log(
    `[iPon import] Sažetak ${cat.name}: API total=${apiTotal ?? "?"}, fetchedIds=${fetchedIds.size}, preskočeno (bez cijene)=${skippedUnparseable}, preskočeno (bez promjene)=${skippedUnchanged}, novih=${imported}, uspješno=${succeeded}, izmijenjeno=${updated}, aktivirano=${activated}, slika=${imageChanged}, rescrape=${rescrapeQueued}, deaktivirano=${deactivated}`
  );
  if (apiTotal != null && fetchedIds.size !== apiTotal) {
    console.warn(
      `[iPon import] fetchedIds (${fetchedIds.size}) ≠ API total (${apiTotal}) — razlika je obično stavke bez cijene ili dupli ID na listi.`
    );
  }

  return {
    imported,
    succeeded,
    updated,
    activated,
    imageChanged,
    rescrapeQueued,
    skippedUnchanged,
    deactivated,
    newProductIds
  };
}

export type IponImportProductsResult = {
  success: boolean;
  imported: number;
  /** Stavke s API-ja uspješno obrađene (postojeći master / ponuda), bez obzira na promjenu. */
  succeeded: number;
  /** Ponude gdje se promijenila HUF cijena. */
  updated: number;
  /** Ponude koje su bile inactive pa su ponovo postavljene na active. */
  activated: number;
  deactivated: number;
  pricesAggregated: number;
  categoriesProcessed: number;
  summary?: {
    imported: number;
    succeeded: number;
    updated: number;
    activated: number;
    image_changed?: number;
    rescrape_queued?: number;
    deactivated_offers: number;
    prices_aggregated: number;
    aggregate_batches: number;
    categories_processed: number;
    import_mode?: string;
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

  const discoveryMode = isIponDiscoveryImportMode();
  const offerIndex = discoveryMode ? await fetchAllIponOfferIndex(supabase) : undefined;

  console.log("[iPon import] Fixture:", filePath, "stavki:", rawItems.length, "→ kategorija:", cat.name);

  const { imported, succeeded, updated, activated, imageChanged, rescrapeQueued, fetchedIds, newProductIds } =
    await upsertItemsForCategory(supabase, cat, rawItems, { offerIndex, discoveryMode });

  let deactivated = 0;
  if (fetchedIds.size > 0) {
    deactivated = await deactivateInactiveIponInCategory(supabase, cat.internalCategoryId, fetchedIds);
    const rec = await reconcileProductsIsActiveFromSupplierOffers(supabase);
    if (rec.error) {
      console.warn("[iPon] reconcile_products_is_active_from_supplier_offers:", rec.error);
    }
  }

  const discoveryModeForAgg = discoveryMode;
  let pricesAggregated = 0;
  let aggregateBatches = 0;
  let aggError: string | undefined;
  let aggWarnings: string[] | undefined;

  if (discoveryModeForAgg) {
    const agg = await aggregateDiscoveryNewProductPrices(discoveryModeForAgg, newProductIds);
    pricesAggregated = agg.pricesAggregated;
    aggregateBatches = agg.aggregateBatches;
    aggError = agg.aggError;
    aggWarnings = agg.aggWarnings;
  } else {
    const agg = await aggregatePrices();
    pricesAggregated = agg.updated;
    aggregateBatches = agg.batches;
    aggError = agg.error;
    aggWarnings = agg.warnings;
  }

  console.log("[iPon import] Fixture završeno.", {
    imported,
    succeeded,
    updated,
    activated,
    imageChanged,
    rescrapeQueued,
    deactivated,
    pricesUpdated: pricesAggregated
  });

  return {
    success: !aggError,
    imported,
    succeeded,
    updated,
    activated,
    deactivated,
    pricesAggregated,
    categoriesProcessed: 1,
    summary: {
      imported,
      succeeded,
      updated,
      activated,
      image_changed: imageChanged,
      rescrape_queued: rescrapeQueued,
      deactivated_offers: deactivated,
      prices_aggregated: pricesAggregated,
      aggregate_batches: aggregateBatches,
      categories_processed: 1,
      import_mode: discoveryModeForAgg ? "discovery" : "full",
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
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
  const discoveryMode = isIponDiscoveryImportMode();

  if (discoveryMode) {
    console.log(
      `[iPon import] Discovery mod — preload indeks, paralelno ${IMPORT_CONCURRENCY}, cijene preko XML sync-a.`
    );
  }

  const offerIndex = discoveryMode ? await fetchAllIponOfferIndex(supabase) : undefined;

  let imported = 0;
  let succeeded = 0;
  let updated = 0;
  let activated = 0;
  let imageChanged = 0;
  let rescrapeQueued = 0;
  let deactivated = 0;
  const newProductIds: string[] = [];

  const firstCat = categories[0];
  if (firstCat) {
    console.log("[iPon import] Warmup sesije (jednom):", firstCat.url);
    await warmupIponSessionForListing(jar, firstCat.url);
    await sleep(IPON_BEFORE_LIST_API_MS);
  }

  for (const cat of categories) {
    const r = await importIponCategory(supabase, cat, jar, {
      skipWarmup: Boolean(firstCat),
      offerIndex,
      discoveryMode
    });
    imported += r.imported;
    succeeded += r.succeeded;
    updated += r.updated;
    activated += r.activated;
    imageChanged += r.imageChanged;
    rescrapeQueued += r.rescrapeQueued;
    deactivated += r.deactivated;
    newProductIds.push(...r.newProductIds);
  }

  let pricesAggregated = 0;
  let aggregateBatches = 0;
  let aggError: string | undefined;
  let aggWarnings: string[] | undefined;

  if (discoveryMode) {
    const agg = await aggregateDiscoveryNewProductPrices(discoveryMode, newProductIds);
    pricesAggregated = agg.pricesAggregated;
    aggregateBatches = agg.aggregateBatches;
    aggError = agg.aggError;
    aggWarnings = agg.aggWarnings;
  } else {
    const agg = await aggregatePrices();
    pricesAggregated = agg.updated;
    aggregateBatches = agg.batches;
    aggError = agg.error;
    aggWarnings = agg.warnings;
  }

  console.log("[iPon import] Završeno.", {
    imported,
    succeeded,
    updated,
    activated,
    imageChanged,
    rescrapeQueued,
    deactivated,
    pricesUpdated: pricesAggregated,
    categories: categories.length,
    mode: discoveryMode ? "discovery" : "full"
  });

  return {
    success: !aggError,
    imported,
    succeeded,
    updated,
    activated,
    deactivated,
    pricesAggregated,
    categoriesProcessed: categories.length,
    summary: {
      imported,
      succeeded,
      updated,
      activated,
      image_changed: imageChanged,
      rescrape_queued: rescrapeQueued,
      deactivated_offers: deactivated,
      prices_aggregated: pricesAggregated,
      aggregate_batches: aggregateBatches,
      categories_processed: categories.length,
      import_mode: discoveryMode ? "discovery" : "full",
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
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
  succeeded: number;
  updated: number;
  activated: number;
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
  const discoveryMode = isIponDiscoveryImportMode();
  const offerIndex = discoveryMode ? await fetchAllIponOfferIndex(supabase) : undefined;

  console.log("[iPon import] Warmup sesije (jedna kategorija):", cat.url);
  await warmupIponSessionForListing(jar, cat.url);
  await sleep(IPON_BEFORE_LIST_API_MS);

  const r = await importIponCategory(supabase, cat, jar, {
    skipWarmup: true,
    offerIndex,
    discoveryMode
  });

  let pricesAggregated = 0;
  let aggregateBatches = 0;
  let aggError: string | undefined;
  let aggWarnings: string[] | undefined;

  if (discoveryMode) {
    const agg = await aggregateDiscoveryNewProductPrices(discoveryMode, r.newProductIds);
    pricesAggregated = agg.pricesAggregated;
    aggregateBatches = agg.aggregateBatches;
    aggError = agg.aggError;
    aggWarnings = agg.aggWarnings;
  } else {
    const agg = await aggregatePrices();
    pricesAggregated = agg.updated;
    aggregateBatches = agg.batches;
    aggError = agg.error;
    aggWarnings = agg.warnings;
  }

  console.log("[iPon import] Jedna kategorija završena.", {
    category: cat.name,
    imported: r.imported,
    succeeded: r.succeeded,
    updated: r.updated,
    activated: r.activated,
    imageChanged: r.imageChanged,
    rescrapeQueued: r.rescrapeQueued,
    deactivated: r.deactivated,
    pricesUpdated: pricesAggregated
  });

  return {
    success: !aggError,
    imported: r.imported,
    succeeded: r.succeeded,
    updated: r.updated,
    activated: r.activated,
    deactivated: r.deactivated,
    pricesAggregated,
    categoriesProcessed: 1,
    summary: {
      imported: r.imported,
      succeeded: r.succeeded,
      updated: r.updated,
      activated: r.activated,
      image_changed: r.imageChanged,
      rescrape_queued: r.rescrapeQueued,
      deactivated_offers: r.deactivated,
      prices_aggregated: pricesAggregated,
      aggregate_batches: aggregateBatches,
      categories_processed: 1,
      import_mode: discoveryMode ? "discovery" : "full",
      single_category: true,
      category_name: cat.name,
      internal_category_id: cat.internalCategoryId,
      ...(aggError ? { aggregate_error: aggError } : {}),
      ...(aggWarnings?.length ? { aggregate_warnings: aggWarnings } : {})
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
    succeeded: result.succeeded,
    updated: result.updated,
    activated: result.activated,
    deactivated: result.deactivated,
    detailEnrichmentEnabled: false,
    pricesAggregated: result.pricesAggregated
  };
}

export { IPON_SUPPLIER_ID } from "./categories";
