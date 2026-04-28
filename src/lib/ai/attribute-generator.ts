import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { generateAttributes } from "lib/ai/openai";

const BATCH_SIZE = 20;
const SSD_BATCH_SIZE = 5;

export type GenerateAttributesResult = {
  success: boolean;
  processed: number;
  inserted: number;
  errors: string[];
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
};

type CategoryAttributeRow = {
  attribute_id: string;
  slug: string;
};

/**
 * Fetch up to `limit` products that have no product_attributes.
 * Samples active products with a category, then filters out those that already have any attributes.
 */
async function fetchProductsWithoutAttributes(
  supabase: SupabaseClient,
  limit: number
): Promise<ProductRow[]> {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, description, category_id")
    .not("category_id", "is", null)
    .eq("is_active", true)
    .limit(limit * 5);

  if (!products?.length) return [];

  const { data: withAttrs } = await supabase
    .from("product_attributes")
    .select("product_id")
    .in("product_id", products.map((p) => p.id));

  const withAttrIds = new Set((withAttrs ?? []).map((r) => r.product_id));
  const without = (products as ProductRow[]).filter((p) => !withAttrIds.has(p.id));
  return without.slice(0, limit);
}

/**
 * Fetch up to `limit` products in the given category that have no product_attributes
 * OR are missing any attribute defined in category_attributes for that category.
 */
async function fetchProductsMissingAttributesForCategory(
  supabase: SupabaseClient,
  categoryId: string,
  limit: number
): Promise<ProductRow[]> {
  const categoryAttrs = await getCategoryAttributeSlugs(supabase, categoryId);
  if (categoryAttrs.length === 0) return [];

  const categoryAttrIds = new Set(categoryAttrs.map((a) => a.attribute_id));

  const { data: products } = await supabase
    .from("products")
    .select("id, name, description, category_id")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .limit(limit * 4);

  if (!products?.length) return [];

  const { data: paRows } = await supabase
    .from("product_attributes")
    .select("product_id, attribute_id")
    .in("product_id", (products as ProductRow[]).map((p) => p.id));

  const existingByProduct = new Map<string, Set<string>>();
  for (const row of paRows ?? []) {
    const r = row as { product_id: string; attribute_id: string };
    let set = existingByProduct.get(r.product_id);
    if (!set) {
      set = new Set();
      existingByProduct.set(r.product_id, set);
    }
    set.add(r.attribute_id);
  }

  const needProcessing = (products as ProductRow[]).filter((p) => {
    const existing = existingByProduct.get(p.id) ?? new Set<string>();
    const hasNone = existing.size === 0;
    const missingAny = Array.from(categoryAttrIds).some((id) => !existing.has(id));
    return hasNone || missingAny;
  });

  return needProcessing.slice(0, limit);
}

/**
 * Get attribute slugs and ids for a category (from category_attributes + attributes).
 */
async function getCategoryAttributeSlugs(
  supabase: SupabaseClient,
  categoryId: string
): Promise<CategoryAttributeRow[]> {
  const { data } = await supabase
    .from("category_attributes")
    .select("attribute_id, attributes(slug)")
    .eq("category_id", categoryId);

  if (!data?.length) return [];

  const rows = data as { attribute_id: string; attributes: { slug: string } | { slug: string }[] }[];
  return rows
    .map((r) => {
      const a = r.attributes;
      const slug = Array.isArray(a) ? a[0]?.slug : a?.slug;
      return slug ? { attribute_id: r.attribute_id, slug } : null;
    })
    .filter((r): r is CategoryAttributeRow => r != null);
}

/**
 * Get existing attribute_ids already set for a product (so we don't overwrite).
 */
async function getExistingAttributeIds(
  supabase: SupabaseClient,
  productId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("product_attributes")
    .select("attribute_id")
    .eq("product_id", productId);
  return new Set((data ?? []).map((r) => r.attribute_id));
}

/**
 * Get existing attribute slug -> value for a product (for SATA/pcie_generation logic).
 */
async function getExistingAttributeValues(
  supabase: SupabaseClient,
  productId: string,
  attributeIdToSlug: Map<string, string>
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("product_attributes")
    .select("attribute_id, value")
    .eq("product_id", productId);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { attribute_id: string; value: string };
    const slug = attributeIdToSlug.get(r.attribute_id);
    if (slug) map.set(slug, r.value);
  }
  return map;
}

const SATA_PCIE_GENERATION_PLACEHOLDER = "-";

function isConnectionSATA(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toUpperCase().includes("SATA");
}

/**
 * Call OpenAI via lib/ai/openai and convert values to strings for DB storage.
 */
async function generateAttributesWithAI(
  productName: string,
  productDescription: string | null,
  attributeSlugs: string[]
): Promise<Record<string, string> | null> {
  if (attributeSlugs.length === 0) return {};

  const parsed = await generateAttributes(productName, productDescription, attributeSlugs);
  const out: Record<string, string> = {};
  for (const [slug, v] of Object.entries(parsed)) {
    if (v === undefined || v === null) continue;
    out[slug] = typeof v === "string" ? v : String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Insert generated attributes into product_attributes. Skips attributes that already exist for the product.
 */
async function insertProductAttributes(
  supabase: SupabaseClient,
  productId: string,
  slugToId: Map<string, string>,
  generated: Record<string, string>,
  existingAttrIds: Set<string>
): Promise<number> {
  const rows: { product_id: string; attribute_id: string; value: string }[] = [];
  for (const [slug, value] of Object.entries(generated)) {
    const attributeId = slugToId.get(slug);
    if (!attributeId || existingAttrIds.has(attributeId)) continue;
    rows.push({ product_id: productId, attribute_id: attributeId, value });
  }
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("product_attributes").insert(rows);
  if (error) throw new Error(`product_attributes insert failed: ${error.message}`);
  return rows.length;
}

/**
 * Process a single product for the AI worker: get category attributes, generate missing
 * values via OpenAI, insert into product_attributes. Uses existing prompts and logic.
 * Returns inserted count; throws on API or DB error.
 */
export async function processSingleProductAttributes(
  supabase: SupabaseClient,
  product: ProductRow
): Promise<{ inserted: number }> {
  const categoryAttrs = await getCategoryAttributeSlugs(supabase, product.category_id);
  if (categoryAttrs.length === 0) return { inserted: 0 };

  const existingAttrIds = await getExistingAttributeIds(supabase, product.id);
  const slugsToGenerate = categoryAttrs
    .filter((a) => !existingAttrIds.has(a.attribute_id))
    .map((a) => a.slug);
  if (slugsToGenerate.length === 0) return { inserted: 0 };

  const generated = await generateAttributesWithAI(
    product.name,
    product.description,
    slugsToGenerate
  );
  if (!generated || Object.keys(generated).length === 0) return { inserted: 0 };

  const slugToId = new Map(categoryAttrs.map((a) => [a.slug, a.attribute_id]));
  const count = await insertProductAttributes(
    supabase,
    product.id,
    slugToId,
    generated,
    existingAttrIds
  );
  return { inserted: count };
}

/**
 * Process one batch of products (up to BATCH_SIZE) that have no attributes.
 * Fetches products without attributes, gets category attributes per product, calls AI, inserts.
 */
export async function runAttributeGenerator(): Promise<GenerateAttributesResult> {
  const supabase = createSupabaseServiceClient();
  const errors: string[] = [];
  let processed = 0;
  let inserted = 0;

  const products = await fetchProductsWithoutAttributes(supabase, BATCH_SIZE);
  if (products.length === 0) {
    return { success: true, processed: 0, inserted: 0, errors: [] };
  }

  for (const product of products) {
    try {
      const categoryAttrs = await getCategoryAttributeSlugs(supabase, product.category_id);
      if (categoryAttrs.length === 0) {
        continue;
      }

      const existingAttrIds = await getExistingAttributeIds(supabase, product.id);
      const slugsToGenerate = categoryAttrs
        .filter((a) => !existingAttrIds.has(a.attribute_id))
        .map((a) => a.slug);
      if (slugsToGenerate.length === 0) {
        processed += 1;
        continue;
      }

      const generated = await generateAttributesWithAI(
        product.name,
        product.description,
        slugsToGenerate
      );
      if (!generated || Object.keys(generated).length === 0) {
        processed += 1;
        continue;
      }

      const slugToId = new Map(categoryAttrs.map((a) => [a.slug, a.attribute_id]));
      const count = await insertProductAttributes(
        supabase,
        product.id,
        slugToId,
        generated,
        existingAttrIds
      );
      processed += 1;
      inserted += count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Product ${product.id} (${product.name}): ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    inserted,
    errors
  };
}

const SSD_CATEGORY_ID = "660c7768-4a5b-47bb-893b-55adc554cd7b";

/**
 * Run AI attribute generation for all products in a category that are missing
 * any category-defined attributes. Uses batch size 5 (for web_search rate limits).
 * Does not overwrite existing attributes. Keeps running until every product has
 * all category attributes (fetch returns zero products).
 */
export async function runCategoryAttributeGenerator(
  categoryId: string,
  categoryName: string,
  batchSize: number = SSD_BATCH_SIZE
): Promise<GenerateAttributesResult> {
  const supabase = createSupabaseServiceClient();
  const errors: string[] = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let batchNumber = 0;

  console.log("AI attribute generation started");
  console.log(`Category: ${categoryName}\n`);

  const categoryAttrs = await getCategoryAttributeSlugs(supabase, categoryId);
  if (categoryAttrs.length === 0) {
    console.log("No category attributes defined. Done.");
    return { success: true, processed: 0, inserted: 0, errors: [] };
  }
  const slugToId = new Map(categoryAttrs.map((a) => [a.slug, a.attribute_id]));
  const attributeIdToSlug = new Map(categoryAttrs.map((a) => [a.attribute_id, a.slug]));
  const pcieGenAttrId = slugToId.get("pcie_generation") ?? null;

  while (true) {
    const products = await fetchProductsMissingAttributesForCategory(
      supabase,
      categoryId,
      batchSize
    );
    if (products.length === 0) break;

    batchNumber += 1;
    console.log(`Batch ${batchNumber}`);

    for (const product of products) {
      try {
        const existingAttrIds = await getExistingAttributeIds(supabase, product.id);
        const existingValues = await getExistingAttributeValues(
          supabase,
          product.id,
          attributeIdToSlug
        );
        const missingSlugs = categoryAttrs
          .filter((a) => !existingAttrIds.has(a.attribute_id))
          .map((a) => a.slug);
        if (missingSlugs.length === 0) {
          totalProcessed += 1;
          continue;
        }

        const existingConnectionSATA = isConnectionSATA(existingValues.get("connection"));
        const missingSlugsForAI = existingConnectionSATA
          ? missingSlugs.filter((s) => s !== "pcie_generation")
          : missingSlugs;

        console.log(`Processing: ${product.name}`);
        console.log(`Missing attributes: ${missingSlugs.join(", ")}`);

        let generated: Record<string, string> = {};
        if (missingSlugsForAI.length > 0) {
          const aiResult = await generateAttributesWithAI(
            product.name,
            product.description,
            missingSlugsForAI
          );
          if (aiResult) generated = aiResult;
        }

        const connectionFromAI = generated.connection ?? "";
        const isSATA = existingConnectionSATA || isConnectionSATA(connectionFromAI);
        const needsPcieGenPlaceholder =
          pcieGenAttrId != null &&
          !existingAttrIds.has(pcieGenAttrId) &&
          isSATA;
        if (needsPcieGenPlaceholder) {
          generated["pcie_generation"] = SATA_PCIE_GENERATION_PLACEHOLDER;
        }

        if (Object.keys(generated).length === 0) {
          totalProcessed += 1;
          continue;
        }

        const count = await insertProductAttributes(
          supabase,
          product.id,
          slugToId,
          generated,
          existingAttrIds
        );
        totalProcessed += 1;
        totalInserted += count;
        console.log(`Inserted attributes: ${count}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Product ${product.id} (${product.name}): ${message}`);
        console.error(`Error: ${message}\n`);
      }
    }
  }

  console.log("AI attribute generation finished");
  console.log("Remaining products: 0");
  console.log(
    `Done. Processed: ${totalProcessed}, Inserted: ${totalInserted}, Errors: ${errors.length}`
  );
  return {
    success: errors.length === 0,
    processed: totalProcessed,
    inserted: totalInserted,
    errors
  };
}

/**
 * Run AI attribute generation for SSD category. Convenience wrapper.
 */
export async function runSSDAttributeGenerator(): Promise<GenerateAttributesResult> {
  return runCategoryAttributeGenerator(SSD_CATEGORY_ID, "SSD", SSD_BATCH_SIZE);
}

/** Category id for "Matične ploče" (motherboards). Attributes: socket, chipset, memory_type, memory_sockets, m2_connectors. */
const MOTHERBOARD_CATEGORY_ID = "bc6b63f8-ac4e-44cc-82e6-030cebee187d";
const MOTHERBOARD_BATCH_SIZE = 5;

/**
 * Run AI attribute generation for all motherboard products. Uses product name and description
 * to generate: socket, chipset, memory_type, memory_sockets, m2_connectors. Does not overwrite
 * existing attributes. Processes in batches until every product has all category attributes.
 */
export async function runMotherboardAttributeGenerator(): Promise<GenerateAttributesResult> {
  return runCategoryAttributeGenerator(
    MOTHERBOARD_CATEGORY_ID,
    "Matične ploče (Motherboards)",
    MOTHERBOARD_BATCH_SIZE
  );
}
