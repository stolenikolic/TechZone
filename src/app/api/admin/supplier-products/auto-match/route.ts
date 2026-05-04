import { NextResponse } from "next/server";
import { aggregatePrices } from "lib/pricing";
import { mergeMatchAudit, resolveSupplierProductMatch } from "lib/suppliers/matchSupplierProduct";
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
const EVENTS_LIMIT = 120;

type MatchRunRow = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  scanned: number;
  linked: number;
  skipped: number;
  errors_count: number;
};

type MatchRunEventRow = {
  id: number;
  run_id: string;
  level: string;
  message: string;
  supplier_product_id: string | null;
  matched_product_id: string | null;
  created_at: string;
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

async function readRunWithEvents(runId?: string) {
  const supabase = createSupabaseServiceClient();
  const runQuery = runId
    ? supabase.from("match_runs").select("*").eq("id", runId).maybeSingle()
    : supabase.from("match_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { data: run, error: runError } = await runQuery;
  if (runError) return { error: runError.message };
  if (!run) return { run: null, events: [] };

  const { data: events, error: eventsError } = await supabase
    .from("match_run_events")
    .select("*")
    .eq("run_id", (run as MatchRunRow).id)
    .order("created_at", { ascending: false })
    .limit(EVENTS_LIMIT);

  if (eventsError) return { error: eventsError.message };
  return {
    run: run as MatchRunRow,
    events: ((events ?? []) as MatchRunEventRow[]).reverse()
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim() || undefined;
  const result = await readRunWithEvents(runId);
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function POST() {
  try {
    const supabase = createSupabaseServiceClient();
    const source = "manual_batch";
    const { data: runInsert, error: runInsertError } = await supabase
      .from("match_runs")
      .insert({ source, status: "running" })
      .select("id")
      .single();
    if (runInsertError || !runInsert?.id) {
      return NextResponse.json({ error: runInsertError?.message ?? "Failed to create match run." }, { status: 400 });
    }
    const runId = runInsert.id as string;
    await insertEvent(runId, "info", "Auto-match run started.");

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
        return NextResponse.json({ error: error.message, runId }, { status: 400 });
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
            return NextResponse.json({ error: skipUpdateError.message, runId }, { status: 400 });
          }
          continue;
        }

        linked += 1;
        await insertEvent(runId, "info", `LINKED by ${match.audit.method.toUpperCase()}`, {
          supplierProductId: row.supplier_product_id,
          matchedProductId: match.productId
        });
        const { error: linkError } = await supabase
          .from("supplier_products")
          .update({
            product_id: match.productId,
            master_match_status: "linked",
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
          return NextResponse.json({ error: linkError.message, runId }, { status: 400 });
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

    return NextResponse.json({ success: true, runId, scanned, linked, skipped, errorsCount, priceRefresh });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/auto-match]", message);
    return NextResponse.json(
      { success: false, scanned: 0, linked: 0, skipped: 0, error: message },
      { status: 500 }
    );
  }
}
