/**
 * ComTrade enrich — backfill spec_snapshot za offer-e bez podataka (faza 2).
 * Run: npx tsx scripts/run-comtrade-enrich.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { createComtradeApiClient } from "./api-client";
import { clearComtradeTokenCache } from "./auth";
import { COMTRADE_SUPPLIER_ID } from "./constants";
import { extractComtradeWarrantyMonths } from "./parseWarranty";
import { withPostgrestTransientRetry } from "./transient-retry";
import { buildComtradeImageUrls, buildComtradeRawJson, buildComtradeSpecSnapshot } from "./transform";
import { normalizeEan, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";

const PAGE_SIZE = 100;
const LOG = "[ComTrade enrich]";

async function fetchPendingOffers(
  supabase: SupabaseClient,
  limit: number
): Promise<Array<{ supplier_product_id: string; raw_json: unknown; mpn: string | null; ean: string | null }>> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id, raw_json, mpn, ean")
    .eq("supplier_id", COMTRADE_SUPPLIER_ID)
    .is("spec_snapshot", null)
    .order("supplier_product_id", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`ComTrade enrich fetch: ${error.message}`);
  return (data ?? []) as Array<{
    supplier_product_id: string;
    raw_json: unknown;
    mpn: string | null;
    ean: string | null;
  }>;
}

export type ComtradeEnrichResult = {
  success: boolean;
  error?: string;
  summary?: {
    processed: number;
    enriched: number;
    failed: number;
  };
};

export async function runComtradeEnrich(options?: { limit?: number }): Promise<ComtradeEnrichResult> {
  clearComtradeTokenCache();
  const supabase = createSupabaseServiceClient();
  const limit = options?.limit ?? 500;
  const summary = { processed: 0, enriched: 0, failed: 0 };

  try {
    console.log(`${LOG} Pokretanje (limit=${limit})…`);

    const pending = await fetchPendingOffers(supabase, limit);
    console.log(`${LOG} Pending offer-a (spec_snapshot=null): ${pending.length}`);
    if (pending.length === 0) {
      console.log(`${LOG} Nema posla.`);
      return { success: true, summary };
    }

    const client = createComtradeApiClient();
    console.log(`${LOG} Login…`);
    await client.ensureAuth();
    console.log(`${LOG} Login OK`);

    for (const row of pending) {
      summary.processed += 1;
      const productNo = row.supplier_product_id;
      try {
        console.log(`${LOG} Enrich ${productNo} (${summary.processed}/${pending.length})…`);
        const detail = await client.fetchProduct(productNo);
        const specs = await client.fetchProductSpecs(productNo);
        const images = await client.fetchProductImages(productNo);
        const imageUrls = buildComtradeImageUrls(images);

        const mpnN = normalizeMpn(row.mpn ?? productNo);
        const eanN = normalizeEan(row.ean ?? detail?.barCode);
        const specSnapshot = buildComtradeSpecSnapshot(detail, specs, mpnN, eanN);
        const warrantyMonths = extractComtradeWarrantyMonths(specSnapshot.specs);
        const now = new Date().toISOString();

        const baseRaw =
          row.raw_json && typeof row.raw_json === "object" && !Array.isArray(row.raw_json)
            ? (row.raw_json as Record<string, unknown>)
            : {};
        const listItem = baseRaw.list_item;
        const productGroupId =
          typeof baseRaw.product_group_id === "string"
            ? baseRaw.product_group_id
            : detail
              ? ""
              : "";
        const rawJson =
          listItem && typeof listItem === "object"
            ? buildComtradeRawJson({
                listItem: listItem as Parameters<typeof buildComtradeRawJson>[0]["listItem"],
                detail,
                imageUrls,
                productGroupId,
                matchAudit: baseRaw.matchAudit
              })
            : { ...baseRaw, product_detail: detail, image_urls: imageUrls };

        const { error } = await withPostgrestTransientRetry("comtrade.enrich", async () =>
          supabase
            .from("supplier_products")
            .update({
              raw_json: rawJson,
              spec_snapshot: specSnapshot,
              specs_fetched_at: now,
              warranty_months: warrantyMonths,
              enrichment_status: "complete",
              updated_at: now
            })
            .eq("supplier_id", COMTRADE_SUPPLIER_ID)
            .eq("supplier_product_id", productNo)
        );
        if (error) throw new Error(error.message);
        summary.enriched += 1;
        console.log(
          `${LOG} OK ${productNo}: specs=${specSnapshot.specs.length} images=${imageUrls.length} warranty=${warrantyMonths ?? "-"}`
        );
      } catch (err) {
        summary.failed += 1;
        console.warn(
          `${LOG} FAIL ${productNo}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    console.log(`${LOG} Završeno.`, summary);
    return { success: summary.failed === 0, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG}`, message);
    return { success: false, error: message, summary };
  }
}
