import { createSupabaseServiceClient } from "utils/supabase";
import { getEffectivePrice } from "lib/effective-price";
import type { PriceSourceRegion } from "lib/pricing/price-source-region";

const PRODUCTS_PAGE_SIZE = 1000;
const ATTRIBUTES_CHUNK_SIZE = 200;

export const OLX_FEED_SCHEMA_VERSION = 1;

export type OlxFeedProduct = {
  id: string;
  title: string;
  shop_price: number;
  price_source_region: PriceSourceRegion;
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
  price_source_region: string | null;
  categories:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
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

function isValidRegion(value: string | null): value is PriceSourceRegion {
  return value === "HU" || value === "BA" || value === "custom";
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
      .select(
        "id, name, main_image, price, custom_price, price_source_region, categories(name, slug)"
      )
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
 * Build OLX JSON feed from storefront-visible products.
 * Skips items without valid shop_price or price_source_region.
 */
export async function buildOlxFeed(options?: BuildOlxFeedOptions): Promise<BuildOlxFeedResult> {
  const startedAt = Date.now();
  const productRows = await loadStorefrontProducts(options?.limit);
  const productIds = productRows.map((row) => row.id);
  const specsByProduct = await loadSpecsByProductId(productIds);

  const products: OlxFeedProduct[] = [];
  let skipped = 0;

  for (const row of productRows) {
    const shopPrice = getEffectivePrice(row.custom_price, row.price);
    if (!Number.isFinite(shopPrice) || shopPrice <= 0) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: invalid shop_price`);
      continue;
    }

    const region = row.price_source_region;
    if (!isValidRegion(region)) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: missing or invalid price_source_region`);
      continue;
    }

    const category = firstCategory(row.categories);
    if (!category) {
      skipped += 1;
      console.warn(`[olx-feed] skipped ${row.id}: missing category`);
      continue;
    }

    products.push({
      id: row.id,
      title: row.name,
      shop_price: shopPrice,
      price_source_region: region,
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
