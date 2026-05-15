/**
 * Cross-supplier enrichment job.
 *
 * Reads spec_snapshot from supplier_products for each product, applies a
 * waterfall by suppliers.enrichment_priority (lower = higher priority), and
 * writes resolved values to product_attributes + products.attributes (jsonb).
 *
 * This job is decoupled from scraping:
 *   - Adding a new attribute to a category only requires re-running this job.
 *   - No new HTTP requests to any supplier.
 *
 * Run: npx tsx scripts/run-enrichment.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  loadAttributeMappings,
  buildAttributeSlugResolver,
  loadCategoryAttributeSlugs
} from "lib/suppliers/registry";
import { mapSpecNameToSlug } from "lib/suppliers/ipon/scrapeDetails";
import type { SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupplierWithPriority = {
  supplierId: string;
  enrichmentPriority: number;
};

type ProductEnrichmentRow = {
  productId: string;
  categoryId: string | null;
  /** Master JSON attributes (admin); do not overwrite keys the user already set. */
  attributesJson: Record<string, unknown> | null;
  suppliers: Array<{
    supplierId: string;
    supplierProductId: string;
    enrichmentPriority: number;
    specSnapshot: SpecSnapshot;
  }>;
};

export type EnrichmentResult = {
  success: boolean;
  productsProcessed: number;
  attributesWritten: number;
  attributesMissing: number;
  errors: number;
  /** Last few per-product error messages (for admin job summary / debugging). */
  errorSamples?: Array<{ productId: string; message: string }>;
  /** Short string for job_runs.summary (API strips nested objects). */
  errorDigest?: string;
};

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Loads all suppliers that have at least one spec_snapshot, ordered by enrichment_priority.
 */
async function loadActiveSupplierPriorities(supabase: SupabaseClient): Promise<SupplierWithPriority[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, enrichment_priority")
    .eq("is_active", true)
    .order("enrichment_priority", { ascending: true });

  if (error) throw new Error(`loadActiveSupplierPriorities: ${error.message}`);
  return (data ?? []).map((r) => ({
    supplierId: r.id as string,
    enrichmentPriority: (r.enrichment_priority as number) ?? 100
  }));
}

/**
 * Fetches a page of products that have at least one spec_snapshot, with their
 * supplier snapshots joined (ordered by enrichment_priority).
 */
async function fetchEnrichmentBatch(
  supabase: SupabaseClient,
  supplierPriorities: SupplierWithPriority[],
  categoryId: string | undefined,
  limit: number,
  offset: number
): Promise<ProductEnrichmentRow[]> {
  let q = supabase
    .from("products")
    .select(
      `id, category_id, attributes,
       supplier_products!inner(supplier_id, supplier_product_id, spec_snapshot,
         suppliers!inner(enrichment_priority))`
    )
    .not("supplier_products.spec_snapshot", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (categoryId) q = q.eq("category_id", categoryId);

  const { data, error } = await q;
  if (error) throw new Error(`fetchEnrichmentBatch: ${error.message}`);

  const productMap = new Map<string, ProductEnrichmentRow>();

  for (const row of (data ?? []) as Array<{
    id: string;
    category_id: string | null;
    attributes?: unknown;
    supplier_products: Array<{
      supplier_id: string;
      supplier_product_id: string;
      spec_snapshot: unknown;
      suppliers: { enrichment_priority: number } | Array<{ enrichment_priority: number }> | null;
    }>;
  }>) {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, {
        productId: row.id,
        categoryId: row.category_id,
        attributesJson: parseProductAttributesJson(row.attributes),
        suppliers: []
      });
    } else {
      const existing = productMap.get(row.id)!;
      if (!existing.attributesJson) {
        const parsed = parseProductAttributesJson(row.attributes);
        if (parsed) existing.attributesJson = parsed;
      }
    }
    const entry = productMap.get(row.id)!;
    for (const sp of row.supplier_products ?? []) {
      if (!sp.spec_snapshot) continue;
      const sup = Array.isArray(sp.suppliers) ? sp.suppliers[0] : sp.suppliers;
      const priority =
        supplierPriorities.find((s) => s.supplierId === sp.supplier_id)?.enrichmentPriority ??
        sup?.enrichment_priority ??
        100;
      entry.suppliers.push({
        supplierId: sp.supplier_id,
        supplierProductId: sp.supplier_product_id,
        enrichmentPriority: priority,
        specSnapshot: sp.spec_snapshot as SpecSnapshot
      });
    }
    // Sort by priority ascending (lower = tried first)
    entry.suppliers.sort((a, b) => a.enrichmentPriority - b.enrichmentPriority);
  }

  return Array.from(productMap.values()).filter((p) => p.suppliers.length > 0);
}

/**
 * Loads existing product_attributes attribute_ids for a product (for skip-if-exists check).
 */
async function loadExistingAttributeIds(
  supabase: SupabaseClient,
  productId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("product_attributes")
    .select("attribute_id")
    .eq("product_id", productId);
  if (error) throw new Error(`loadExistingAttributeIds: ${error.message}`);
  return new Set((data ?? []).map((r) => r.attribute_id as string));
}

/**
 * Loads slug → attribute_id map for a list of slugs.
 */
async function loadSlugToAttributeId(
  supabase: SupabaseClient,
  slugs: string[]
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const { data, error } = await supabase
    .from("attributes")
    .select("id, slug")
    .in("slug", slugs);
  if (error) throw new Error(`loadSlugToAttributeId: ${error.message}`);
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    if (r.slug && r.id) map.set(r.slug as string, r.id as string);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Resolution logic
// ---------------------------------------------------------------------------

function parseProductAttributesJson(attrs: unknown): Record<string, unknown> | null {
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) return attrs as Record<string, unknown>;
  return null;
}

/** Non-empty manual value in products.attributes JSON (admin / legacy). */
function manualJsonHasValue(attrs: Record<string, unknown> | null, slug: string): boolean {
  if (!attrs || typeof attrs !== "object") return false;
  const v = attrs[slug];
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number" && Number.isFinite(v)) return true;
  if (typeof v === "boolean") return true;
  return false;
}

function safeSpecCell(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

/**
 * Finds the value for a given attribute slug by trying each supplier's spec_snapshot
 * in priority order. Uses supplier_attribute_mappings (DB) with mapSpecNameToSlug fallback.
 */
async function resolveAttributeValue(
  slug: string,
  suppliers: ProductEnrichmentRow["suppliers"],
  categoryId: string | null,
  mappingsBySupplier: Map<string, ReturnType<typeof buildAttributeSlugResolver>>
): Promise<string | null> {
  for (const sup of suppliers) {
    const resolver = mappingsBySupplier.get(sup.supplierId);
    if (!resolver) continue;
    const rawSpecs = sup.specSnapshot.specs;
    const specs: unknown[] = Array.isArray(rawSpecs) ? rawSpecs : [];
    for (const raw of specs) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as { name?: unknown; value?: unknown };
      const name = safeSpecCell(row.name).trim();
      if (!name) continue;
      const value = safeSpecCell(row.value).trim();
      if (!value) continue;
      const resolvedSlug = resolver(name);
      if (resolvedSlug === slug) return value;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

async function writeProductAttribute(
  supabase: SupabaseClient,
  productId: string,
  attributeId: string,
  value: string
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("product_attributes")
    .select("product_id")
    .eq("product_id", productId)
    .eq("attribute_id", attributeId)
    .maybeSingle();
  if (selErr) throw new Error(`writeProductAttribute(select): ${selErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("product_attributes")
      .update({ value })
      .eq("product_id", productId)
      .eq("attribute_id", attributeId);
    if (error) throw new Error(`writeProductAttribute(update): ${error.message}`);
  } else {
    const { error } = await supabase.from("product_attributes").insert({
      product_id: productId,
      attribute_id: attributeId,
      value
    });
    if (error) throw new Error(`writeProductAttribute(insert): ${error.message}`);
  }
}

async function patchProductAttributesJsonb(
  supabase: SupabaseClient,
  productId: string,
  patch: Record<string, string>
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { data: current, error: readErr } = await supabase
    .from("products")
    .select("attributes")
    .eq("id", productId)
    .maybeSingle();
  if (readErr) throw new Error(`patchProductAttributesJsonb read: ${readErr.message}`);
  const prev =
    current?.attributes && typeof current.attributes === "object" && !Array.isArray(current.attributes)
      ? (current.attributes as Record<string, unknown>)
      : {};
  const merged = { ...prev, ...patch };
  const { error: writeErr } = await supabase
    .from("products")
    .update({ attributes: merged, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (writeErr) throw new Error(`patchProductAttributesJsonb write: ${writeErr.message}`);
}

// ---------------------------------------------------------------------------
// Public run function
// ---------------------------------------------------------------------------

export type RunEnrichmentOptions = {
  /** Limit to products of a specific category. */
  categoryId?: string;
  /**
   * If true, re-enriches even attributes already present in product_attributes.
   * Default: false (only fill missing).
   */
  overwrite?: boolean;
  /** Page size for product batches. Default: 50. */
  batchSize?: number;
  /** Log each resolved attribute. Default: false. */
  verbose?: boolean;
};

export async function runEnrichment(options?: RunEnrichmentOptions): Promise<EnrichmentResult> {
  const supabase = createSupabaseServiceClient();
  const categoryId = options?.categoryId;
  const overwrite = options?.overwrite ?? false;
  const batchSize = options?.batchSize ?? 50;
  const verbose = options?.verbose ?? false;

  const supplierPriorities = await loadActiveSupplierPriorities(supabase);

  // Pre-load attribute mappings for all active suppliers
  const mappingsBySupplier = new Map<string, ReturnType<typeof buildAttributeSlugResolver>>();
  for (const sup of supplierPriorities) {
    const mappings = await loadAttributeMappings(sup.supplierId, { supabase });
    mappingsBySupplier.set(sup.supplierId, buildAttributeSlugResolver(mappings, categoryId ?? null, mapSpecNameToSlug));
  }

  let productsProcessed = 0;
  let attributesWritten = 0;
  let attributesMissing = 0;
  let errors = 0;
  const errorSamples: Array<{ productId: string; message: string }> = [];
  let offset = 0;

  console.log("[enrichment] Pokrenut cross-supplier enrichment job.");
  if (categoryId) console.log("[enrichment] Filtar kategorije:", categoryId);

  for (;;) {
    const batch = await fetchEnrichmentBatch(supabase, supplierPriorities, categoryId, batchSize, offset);
    if (batch.length === 0) break;

    for (const product of batch) {
      try {
        const slugs = await loadCategoryAttributeSlugs(product.categoryId ?? "", { supabase });
        if (slugs.length === 0) {
          if (verbose) console.log(`[enrichment] ${product.productId}: no category attributes configured`);
          productsProcessed += 1;
          continue;
        }

        const slugToId = await loadSlugToAttributeId(supabase, slugs);
        const existingIds = overwrite ? new Set<string>() : await loadExistingAttributeIds(supabase, product.productId);

        // Per-product resolvers scoped to this product's category
        const resolvers = new Map<string, ReturnType<typeof buildAttributeSlugResolver>>();
        for (const sup of product.suppliers) {
          const mappings = await loadAttributeMappings(sup.supplierId, { supabase });
          resolvers.set(
            sup.supplierId,
            buildAttributeSlugResolver(mappings, product.categoryId, mapSpecNameToSlug)
          );
        }

        const patch: Record<string, string> = {};

        for (const slug of slugs) {
          const attributeId = slugToId.get(slug);
          if (!attributeId) continue;
          if (!overwrite && existingIds.has(attributeId)) continue;
          if (!overwrite && manualJsonHasValue(product.attributesJson, slug)) continue;

          const value = await resolveAttributeValue(slug, product.suppliers, product.categoryId, resolvers);
          if (value) {
            await writeProductAttribute(supabase, product.productId, attributeId, value);
            patch[slug] = value;
            attributesWritten += 1;
            if (verbose) console.log(`[enrichment] ${product.productId} ${slug}=${value}`);
          } else {
            attributesMissing += 1;
            if (verbose) console.log(`[enrichment] ${product.productId} ${slug}: no value found`);
          }
        }

        await patchProductAttributesJsonb(supabase, product.productId, patch);
        productsProcessed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[enrichment] Error on product ${product.productId}:`, message);
        errors += 1;
        if (errorSamples.length < 15) {
          errorSamples.push({ productId: product.productId, message });
        }
      }
    }

    offset += batchSize;
    console.log(
      `[enrichment] Batch obrađen: offset=${offset} productsProcessed=${productsProcessed} written=${attributesWritten} missing=${attributesMissing} errors=${errors}`
    );

    if (batch.length < batchSize) break;
  }

  console.log(
    `[enrichment] Završen: productsProcessed=${productsProcessed}, attributesWritten=${attributesWritten}, attributesMissing=${attributesMissing}, errors=${errors}`
  );

  const digest =
    errorSamples.length > 0
      ? errorSamples
          .map((e) => {
            const msg = e.message.length > 180 ? `${e.message.slice(0, 180)}…` : e.message;
            return `${e.productId}: ${msg}`;
          })
          .join(" || ")
      : undefined;

  return {
    success: errors === 0,
    productsProcessed,
    attributesWritten,
    attributesMissing,
    errors,
    errorSamples: errorSamples.length > 0 ? errorSamples : undefined,
    errorDigest: digest
  };
}
