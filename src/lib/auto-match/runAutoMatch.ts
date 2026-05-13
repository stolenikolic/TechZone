/**
 * Auto-match background job: scans unmatched `supplier_products` rows, links
 * them to master `products` by MPN/EAN, and refreshes aggregated prices.
 *
 * Coexists with the legacy `match_runs` / `match_run_events` tables (one row
 * per run + one row per event) for backward compatibility with the existing
 * /admin UI. The outer caller wraps this function with `withJobRun(...)` to
 * additionally emit `job_runs` / `job_run_events` records.
 */

import { aggregatePrices } from "lib/pricing";
import { logEvent, type JobRunHandle } from "lib/jobs/job-runner";
import { mergeMatchAudit, resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { createSupabaseServiceClient } from "utils/supabase";

type PendingSupplierRow = {
  id: string;
  supplier_id: string;
  supplier_product_id: string;
  mpn: string | null;
  ean: string | null;
  raw_json: unknown;
};

const PAGE_SIZE = 500;

export type AutoMatchResult = {
  success: boolean;
  runId?: string;
  scanned: number;
  linked: number;
  skipped: number;
  errorsCount?: number;
  error?: string;
  priceRefresh?: { updated?: number; batches?: number; error?: string };
  summary?: {
    scanned: number;
    linked: number;
    skipped: number;
    errors_count: number;
    price_refresh_updated?: number;
    price_refresh_batches?: number;
    price_refresh_error?: string;
  };
};

async function insertEvent(
  runId: string,
  level: "info" | "warn" | "error",
  message: string,
  details?: { supplierProductId?: string; matchedProductId?: string }
) {
  const supabase = createSupabaseServiceClient();
  await supabase.from("match_run_events").insert({
    run_id: runId,
    level,
    message,
    supplier_product_id: details?.supplierProductId ?? null,
    matched_product_id: details?.matchedProductId ?? null
  });
}

export async function runAutoMatch(jobHandle?: JobRunHandle): Promise<AutoMatchResult> {
  const handle: JobRunHandle = jobHandle ?? { runId: null };
  const supabase = createSupabaseServiceClient();
  const source = "manual_batch";
  const { data: runInsert, error: runInsertError } = await supabase
    .from("match_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (runInsertError || !runInsert?.id) {
    return {
      success: false,
      scanned: 0,
      linked: 0,
      skipped: 0,
      error: runInsertError?.message ?? "Failed to create match run."
    };
  }
  const runId = runInsert.id as string;
  await insertEvent(runId, "info", "Auto-match run started.");
  await logEvent(handle, { level: "info", message: `match_runs.id=${runId}` });

  let cursor: string | null = null;
  let scanned = 0;
  let linked = 0;
  let skipped = 0;
  let errorsCount = 0;

  for (;;) {
    let query = supabase
      .from("supplier_products")
      .select("id, supplier_id, supplier_product_id, mpn, ean, raw_json")
      .is("product_id", null)
      .eq("master_match_status", "pending_review")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.gt("id", cursor);
    }

    const { data, error } = await query;

    if (error) {
      errorsCount += 1;
      await insertEvent(runId, "error", `Fetch pending offers failed: ${error.message}`);
      await supabase
        .from("match_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          scanned,
          linked,
          skipped,
          errors_count: errorsCount
        })
        .eq("id", runId);
      return { success: false, runId, scanned, linked, skipped, errorsCount, error: error.message };
    }

    const page = (data ?? []) as PendingSupplierRow[];
    if (page.length === 0) break;
    await insertEvent(runId, "info", `Processing ${page.length} offers...`);

    for (const row of page) {
      scanned += 1;
      const match = await resolveSupplierProductMatch(supabase, {
        ean: row.ean,
        mpn: row.mpn
      });

      if (!match.productId) {
        skipped += 1;
        await insertEvent(
          runId,
          match.audit.reason?.includes("ambiguous") ? "warn" : "info",
          `SKIPPED ${match.audit.reason ?? "no_unique_match"} via ${match.audit.method.toUpperCase()}`,
          { supplierProductId: row.supplier_product_id }
        );
        const { error: skipUpdateError } = await supabase
          .from("supplier_products")
          .update({
            raw_json: mergeMatchAudit(row.raw_json, match.audit),
            updated_at: new Date().toISOString()
          })
          .eq("id", row.id);
        if (skipUpdateError) {
          errorsCount += 1;
          await insertEvent(runId, "error", `Supplier offer update failed: ${skipUpdateError.message}`, {
            supplierProductId: row.supplier_product_id
          });
          await supabase
            .from("match_runs")
            .update({
              status: "failed",
              finished_at: new Date().toISOString(),
              scanned,
              linked,
              skipped,
              errors_count: errorsCount
            })
            .eq("id", runId);
          return {
            success: false,
            runId,
            scanned,
            linked,
            skipped,
            errorsCount,
            error: skipUpdateError.message
          };
        }
        continue;
      }

      linked += 1;
      await insertEvent(runId, "info", `LINKED by ${match.audit.method.toUpperCase()}`, {
        supplierProductId: row.supplier_product_id,
        matchedProductId: match.productId
      });
      const { data: masterIdentifiers, error: masterIdentifiersError } = await supabase
        .from("products")
        .select("mpn, ean")
        .eq("id", match.productId)
        .maybeSingle();
      if (masterIdentifiersError) {
        errorsCount += 1;
        await insertEvent(runId, "error", `Master identifiers lookup failed: ${masterIdentifiersError.message}`, {
          supplierProductId: row.supplier_product_id
        });
        continue;
      }
      const identifierSync = getIdentifierSyncUpdate(
        { mpn: row.mpn, ean: row.ean },
        { mpn: masterIdentifiers?.mpn ?? null, ean: masterIdentifiers?.ean ?? null }
      );
      const { error: linkError } = await supabase
        .from("supplier_products")
        .update({
          product_id: match.productId,
          master_match_status: "linked",
          ...identifierSync.update,
          raw_json: mergeMatchAudit(row.raw_json, match.audit),
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);
      if (linkError) {
        errorsCount += 1;
        await insertEvent(runId, "error", `Supplier offer link update failed: ${linkError.message}`, {
          supplierProductId: row.supplier_product_id
        });
        await supabase
          .from("match_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            scanned,
            linked,
            skipped,
            errors_count: errorsCount
          })
          .eq("id", runId);
        return { success: false, runId, scanned, linked, skipped, errorsCount, error: linkError.message };
      }
    }

    cursor = page[page.length - 1]?.id ?? cursor;
    if (page.length < PAGE_SIZE) break;
  }

  const priceRefresh = linked > 0 ? await aggregatePrices() : { updated: 0, batches: 0 };
  if (priceRefresh.error) {
    errorsCount += 1;
    await insertEvent(runId, "error", `Price refresh failed: ${priceRefresh.error}`);
  } else {
    await insertEvent(runId, "info", `Price refresh: updated=${priceRefresh.updated ?? 0}, batches=${priceRefresh.batches ?? 0}`);
  }

  await supabase
    .from("match_runs")
    .update({
      status: errorsCount > 0 ? "failed" : "success",
      finished_at: new Date().toISOString(),
      scanned,
      linked,
      skipped,
      errors_count: errorsCount
    })
    .eq("id", runId);
  await insertEvent(runId, "info", "Auto-match run finished.");

  return {
    success: errorsCount === 0,
    runId,
    scanned,
    linked,
    skipped,
    errorsCount,
    priceRefresh,
    summary: {
      scanned,
      linked,
      skipped,
      errors_count: errorsCount,
      price_refresh_updated: priceRefresh.updated,
      price_refresh_batches: priceRefresh.batches,
      ...(priceRefresh.error ? { price_refresh_error: priceRefresh.error } : {})
    }
  };
}
