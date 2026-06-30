import { createSupabaseServiceClient } from "utils/supabase";
import { getEffectivePrice } from "lib/effective-price";
import { resolvePricingSettingsRow } from "lib/pricing/resolve-settings";
import type { PricingSettingsRow } from "lib/pricing/types";
import {
  buildRegionalOffers,
  type FeedRegionalOffer,
  type SupplierOfferInput
} from "./acquisition-price";

const PRODUCTS_PAGE_SIZE = 1000;
const ATTRIBUTES_CHUNK_SIZE = 200;
const OFFERS_CHUNK_SIZE = 200;

export const OLX_FEED_SCHEMA_VERSION = 3;

export type OlxFeedRegionalOffers = {
  HU?: FeedRegionalOffer;
  BA?: FeedRegionalOffer;
};

export type OlxFeedProduct = {
  id: string;
  title: string;
  shop_price: number;
  offers: OlxFeedRegionalOffers;
  category: { name: string; slug: string };
  main_image: string | null;
  specs: Record<string, string>;
};

export type OlxFeedDocument = {
  schema_version: number;
  generated_at: string;
  count: number;
  products: OlxFeedProduct[];
};

export type BuildOlxFeedResult = OlxFeedDocument & {
  skipped: number;
};

type ProductRow = {
  id: string;
  name: string;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  categories:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
};

type SupplierProductRow = {
  product_id: string;
  supplier_id: string;
  price_amount: number;
  currency: string;
  suppliers:
    | { code: string; pricing_formula: string | null }
    | { code: string; pricing_formula: string | null }[]
    | null;
};

function firstCategory(
  raw: ProductRow["categories"]
): { name: string; slug: string } | null {
  if (raw == null) return null;
  const c = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!c?.name || !c?.slug) return null;
  return { name: c.name, slug: c.slug };
}

function firstSupplier(raw: SupplierProductRow["suppliers"]) {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

async function loadPricingAlzaTax(): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("pricing_settings").select("*").limit(1);
  if (error) throw new Error(`pricing_settings fetch failed: ${error.message}`);
  const { settings } = resolvePricingSettingsRow((data?.[0] ?? null) as PricingSettingsRow | null);
  if (!Number.isFinite(settings.alza_tax) || settings.alza_tax <= 0) {
    throw new Error(
      "pricing_settings.alza_tax is missing or invalid (required for HU non-iPon offers)."
    );
  }
  return settings.alza_tax;
}

async function loadSpecsByProductId(
  productIds: string[]
): Promise<Map<string, Record<string, string>>> {
  const specsByProduct = new Map<string, Record<string, string>>();
  if (productIds.length === 0) return specsByProduct;

  const supabase = createSupabaseServiceClient();
  const { data: attributeSlugRows, error: slugError } = await supabase
    .from("attributes")
    .select("id, slug");
  if (slugError) throw new Error(`attributes fetch failed: ${slugError.message}`);

  const attributeIdToSlug = new Map<string, string>();
  for (const row of attributeSlugRows ?? []) {
    if (row.id && row.slug) attributeIdToSlug.set(row.id as string, row.slug as string);
  }

  for (let i = 0; i < productIds.length; i += ATTRIBUTES_CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + ATTRIBUTES_CHUNK_SIZE);
    const { data: attributeRows, error: attributeError } = await supabase
      .from("product_attributes")
      .select("product_id, attribute_id, value")
      .in("product_id", chunk);
    if (attributeError) {
      throw new Error(`product_attributes fetch failed: ${attributeError.message}`);
    }

    for (const row of attributeRows ?? []) {
      if (!row.product_id || !row.attribute_id || row.value == null) continue;
      const productId = row.product_id as string;
      const slug = attributeIdToSlug.get(row.attribute_id as string);
      if (!slug) continue;
      if (!specsByProduct.has(productId)) specsByProduct.set(productId, {});
      specsByProduct.get(productId)![slug] = String(row.value);
    }
  }

  return specsByProduct;
}

function toSupplierOfferInput(row: SupplierProductRow): SupplierOfferInput | null {
  const supplier = firstSupplier(row.suppliers);
  const code = supplier?.code?.trim();
  if (!code) return null;
  return {
    supplier_id: row.supplier_id,
    price_amount: Number(row.price_amount),
    currency: row.currency ?? "",
    supplier_code: code,
    pricing_formula: supplier.pricing_formula
  };
}

async function loadSupplierOffersByProductId(
  productIds: string[]
): Promise<Map<string, SupplierOfferInput[]>> {
  const offersByProduct = new Map<string, SupplierOfferInput[]>();
  if (productIds.length === 0) return offersByProduct;

  const supabase = createSupabaseServiceClient();

  for (let i = 0; i < productIds.length; i += OFFERS_CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + OFFERS_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("supplier_products")
      .select(
        "product_id, supplier_id, price_amount, currency, suppliers(code, pricing_formula)"
      )
      .in("product_id", chunk)
      .eq("is_active", true)
      .order("supplier_id", { ascending: true });

    if (error) throw new Error(`supplier_products fetch failed: ${error.message}`);

    for (const row of (data ?? []) as SupplierProductRow[]) {
      const input = toSupplierOfferInput(row);
      if (!input) continue;
      const list = offersByProduct.get(row.product_id) ?? [];
      list.push(input);
      offersByProduct.set(row.product_id, list);
    }
  }

  return offersByProduct;
}

async function loadStorefrontProducts(limit?: number): Promise<ProductRow[]> {
  const supabase = createSupabaseServiceClient();
  const rows: ProductRow[] = [];
  let offset = 0;

  while (true) {
    const pageSize =
      limit != null ? Math.min(PRODUCTS_PAGE_SIZE, limit - rows.length) : PRODUCTS_PAGE_SIZE;
    if (pageSize <= 0) break;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, main_image, price, custom_price, categories(name, slug)")
      .eq("is_active", true)
      .eq("publish_locked", false)
      .or("price.gt.0,custom_price.gt.0")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`products fetch failed: ${error.message}`);

    const chunk = (data ?? []) as ProductRow[];
    if (chunk.length === 0) break;
    rows.push(...chunk);
    offset += chunk.length;
    if (limit != null && rows.length >= limit) break;
    if (chunk.length < pageSize) break;
  }

  return rows;
}

export type BuildOlxFeedOptions = {
  limit?: number;
};

/**
 * Build OLX JSON feed (v3): per-region best offers HU + BA from all active supplier_products.
 */
export async function buildOlxFeed(options?: BuildOlxFeedOptions): Promise<BuildOlxFeedResult> {
  const startedAt = Date.now();
  const alzaTax = await loadPricingAlzaTax();
  const productRows = await loadStorefrontProducts(options?.limit);
  const productIds = productRows.map((row) => row.id);
  const [specsByProduct, supplierOffersByProduct] = await Promise.all([
    loadSpecsByProductId(productIds),
    loadSupplierOffersByProductId(productIds)
  ]);

  const products: OlxFeedProduct[] = [];
  let skipped = 0;

  for (const row of productRows) {
    const shopPrice = getEffectivePrice(row.custom_price, row.price);
    if (!Number.isFinite(shopPrice) || shopPrice <= 0) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: invalid shop_price`);
      continue;
    }

    const category = firstCategory(row.categories);
    if (!category) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: missing category`);
      continue;
    }

    const supplierOffers = supplierOffersByProduct.get(row.id) ?? [];
    const offers = buildRegionalOffers(supplierOffers, alzaTax);
    if (!offers.HU && !offers.BA) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: no HU or BA regional offer`);
      continue;
    }

    products.push({
      id: row.id,
      title: row.name,
      shop_price: shopPrice,
      offers,
      category,
      main_image: row.main_image,
      specs: specsByProduct.get(row.id) ?? {}
    });
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[olx-feed] built ${products.length} products, skipped ${skipped}, ${durationMs}ms`
  );

  return {
    schema_version: OLX_FEED_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    count: products.length,
    products,
    skipped
  };
}
