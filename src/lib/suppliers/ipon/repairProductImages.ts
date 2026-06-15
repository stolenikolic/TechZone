/**
 * One-off / maintenance: re-ingest iPon pictures from raw_json → product_images.
 * Run: npx tsx scripts/run-ipon-repair-product-images.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { IPON_SUPPLIER_ID } from "./categories";
import {
  getPictureUrlsFromRawJson,
  getPicturesIngestedFrom,
  needsPicturesIngest,
  reingestIponProductImages
} from "./ipon-product-images";

const DB_PAGE_SIZE = 1000;

type SupplierRow = {
  supplier_product_id: string;
  product_id: string;
  raw_json: unknown;
  updated_at: string;
};

export type RunIponRepairProductImagesOptions = {
  dryRun?: boolean;
  /** Max products to process (0 = no limit). */
  limit?: number;
  /** All iPon offers with pictures in raw_json. */
  all?: boolean;
  /** Only where pictures_ingested_from missing/mismatch or offer newer than product_images. */
  staleOnly?: boolean;
};

export type RunIponRepairProductImagesResult = {
  scanned: number;
  candidates: number;
  repaired: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
};

async function fetchIponOfferPage(
  supabase: SupabaseClient,
  offset: number
): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id, product_id, raw_json, updated_at")
    .eq("supplier_id", IPON_SUPPLIER_ID)
    .not("product_id", "is", null)
    .order("supplier_product_id", { ascending: true })
    .range(offset, offset + DB_PAGE_SIZE - 1);

  if (error) throw new Error(`repair fetch: ${error.message}`);
  return (data ?? []) as SupplierRow[];
}

async function isStaleOffer(
  supabase: SupabaseClient,
  row: SupplierRow,
  pictureUrls: string[]
): Promise<boolean> {
  const first = pictureUrls[0];
  if (!first) return false;

  if (needsPicturesIngest(row.raw_json, first)) return true;

  const { data: images } = await supabase
    .from("product_images")
    .select("created_at")
    .eq("product_id", row.product_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestImageAt = images?.[0]?.created_at;
  if (!latestImageAt) return true;

  return new Date(row.updated_at).getTime() > new Date(String(latestImageAt)).getTime();
}

export async function runIponRepairProductImages(
  options?: RunIponRepairProductImagesOptions
): Promise<RunIponRepairProductImagesResult> {
  const dryRun = options?.dryRun ?? false;
  const limit = options?.limit ?? 0;
  const all = options?.all ?? false;
  const staleOnly = options?.staleOnly ?? !all;

  const supabase = createSupabaseServiceClient();

  let scanned = 0;
  let candidates = 0;
  let repaired = 0;
  let failed = 0;
  let skipped = 0;
  let offset = 0;

  console.log("[iPon repair images] Pokrenut.", { dryRun, limit: limit || "∞", staleOnly, all });

  for (;;) {
    const page = await fetchIponOfferPage(supabase, offset);
    if (page.length === 0) break;

    for (const row of page) {
      if (limit > 0 && repaired + failed >= limit) {
        console.log("[iPon repair images] Limit dostignut.");
        return { scanned, candidates, repaired, failed, skipped, dryRun };
      }

      scanned += 1;
      const pictureUrls = getPictureUrlsFromRawJson(row.raw_json);
      if (pictureUrls.length === 0) {
        skipped += 1;
        continue;
      }

      const shouldRepair = all || (staleOnly && (await isStaleOffer(supabase, row, pictureUrls)));
      if (!shouldRepair) {
        skipped += 1;
        continue;
      }

      candidates += 1;

      if (dryRun) {
        console.log(
          `[iPon repair images] dry-run: ${row.supplier_product_id} → ${pictureUrls[0]?.slice(0, 80)}…`
        );
        continue;
      }

      try {
        const existingRaw =
          row.raw_json && typeof row.raw_json === "object"
            ? (row.raw_json as Record<string, unknown>)
            : null;

        const { ok } = await reingestIponProductImages(supabase, row.product_id, pictureUrls, {
          supplierProductId: row.supplier_product_id,
          existingRaw
        });

        if (ok) {
          repaired += 1;
          if (repaired % 50 === 0) {
            console.log(`[iPon repair images] Obrađeno ${repaired}…`);
          }
        } else {
          failed += 1;
          console.warn(`[iPon repair images] FAIL ingest ${row.supplier_product_id}`);
        }
      } catch (err) {
        failed += 1;
        console.warn(
          `[iPon repair images] ERROR ${row.supplier_product_id}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    offset += page.length;
    if (page.length < DB_PAGE_SIZE) break;
  }

  const result = { scanned, candidates, repaired, failed, skipped, dryRun };
  console.log("[iPon repair images] Završeno.", result);
  return result;
}

/** Exported for tests / diagnostics. */
export { getPicturesIngestedFrom, needsPicturesIngest };
