/**
 * AI product description generation job.
 *
 * Runs after enrichment. Generates descriptions for products with >= 3 AI-selected
 * specifications, skipping locked/unchanged rows via input hash.
 *
 * Run: npx tsx scripts/run-ai-descriptions.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import {
  generateDescriptionForProduct,
  type ProductForAiDescription
} from "lib/ai-descriptions/generate-for-product";
import type { AiDescriptionsResult } from "lib/ai-descriptions/types";

export type RunAiDescriptionsOptions = {
  categoryId?: string;
  batchSize?: number;
  verbose?: boolean;
  /** When true, regenerate even if hash unchanged (still respects locked unless force on single). */
  overwrite?: boolean;
  /** Auto-approve after QA (post-pilot mode). */
  autoApprove?: boolean;
};

async function fetchProductBatch(
  supabase: SupabaseClient,
  categoryId: string | undefined,
  limit: number,
  offset: number
) {
  let q = supabase
    .from("products")
    .select(
      `id, name, brand, category_id, description,
       ai_description_input_hash, ai_description_locked, ai_description_status,
       categories(name, slug)`
    )
    .eq("is_active", true)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (categoryId) q = q.eq("category_id", categoryId);

  const { data, error } = await q;
  if (error) throw new Error(`fetchProductBatch: ${error.message}`);
  return data ?? [];
}

export async function runAiDescriptions(
  options?: RunAiDescriptionsOptions
): Promise<AiDescriptionsResult> {
  const supabase = createSupabaseServiceClient();
  const categoryId = options?.categoryId;
  const batchSize = options?.batchSize ?? 25;
  const verbose = options?.verbose ?? false;
  const autoApprove = options?.autoApprove ?? false;

  let productsProcessed = 0;
  let descriptionsWritten = 0;
  let skippedWeak = 0;
  let skippedUnchanged = 0;
  let skippedLocked = 0;
  let qaFailed = 0;
  let errors = 0;
  const errorSamples: Array<{ productId: string; message: string }> = [];
  let offset = 0;

  console.log("[ai-descriptions] Pokrenut AI opis job.");
  if (categoryId) console.log("[ai-descriptions] Filtar kategorije:", categoryId);
  if (autoApprove) console.log("[ai-descriptions] Auto-approve uključen.");

  for (;;) {
    const batch = await fetchProductBatch(supabase, categoryId, batchSize, offset);
    if (batch.length === 0) break;

    for (const row of batch) {
      productsProcessed += 1;
      try {
        const result = await generateDescriptionForProduct(
          supabase,
          {
            id: row.id as string,
            name: row.name as string,
            brand: (row.brand as string | null) ?? null,
            category_id: (row.category_id as string | null) ?? null,
            description: (row.description as string | null) ?? null,
            ai_description_input_hash: (row.ai_description_input_hash as string | null) ?? null,
            ai_description_locked: Boolean(row.ai_description_locked),
            ai_description_status: (row.ai_description_status as string | null) ?? null,
            categories: row.categories as ProductForAiDescription["categories"]
          },
          { force: options?.overwrite, autoApprove }
        );

        if (result.ok) {
          descriptionsWritten += 1;
          if (verbose) console.log(`[ai-descriptions] ${row.id} written`);
        } else {
          switch (result.reason) {
            case "weak":
              skippedWeak += 1;
              if (verbose) console.log(`[ai-descriptions] ${row.id} weak (premalo spec)`);
              break;
            case "unchanged":
              skippedUnchanged += 1;
              break;
            case "locked":
              skippedLocked += 1;
              break;
            case "qa_failed":
              qaFailed += 1;
              if (verbose) console.log(`[ai-descriptions] ${row.id} QA failed: ${result.message}`);
              break;
            case "disabled":
              if (verbose) console.log(`[ai-descriptions] ${row.id} category disabled`);
              break;
            default:
              break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ai-descriptions] Error on product ${row.id}:`, message);
        errors += 1;
        if (errorSamples.length < 15) {
          errorSamples.push({ productId: row.id as string, message });
        }
      }
    }

    offset += batchSize;
    console.log(
      `[ai-descriptions] Batch: offset=${offset} processed=${productsProcessed} written=${descriptionsWritten} weak=${skippedWeak} unchanged=${skippedUnchanged} locked=${skippedLocked} qaFailed=${qaFailed} errors=${errors}`
    );

    if (batch.length < batchSize) break;
  }

  const digest =
    errorSamples.length > 0
      ? errorSamples
          .map((e) => {
            const msg = e.message.length > 180 ? `${e.message.slice(0, 180)}…` : e.message;
            return `${e.productId}: ${msg}`;
          })
          .join(" || ")
      : undefined;

  console.log(
    `[ai-descriptions] Završen: processed=${productsProcessed}, written=${descriptionsWritten}, errors=${errors}`
  );

  return {
    success: errors === 0,
    productsProcessed,
    descriptionsWritten,
    skippedWeak,
    skippedUnchanged,
    skippedLocked,
    qaFailed,
    errors,
    errorSamples: errorSamples.length > 0 ? errorSamples : undefined,
    errorDigest: digest
  };
}
