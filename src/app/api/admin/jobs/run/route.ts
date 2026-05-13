import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { withJobRun, type JobType } from "lib/jobs/job-runner";
import { IPON_SUPPLIER_ID } from "lib/suppliers/ipon/categories";
import { PCX_SUPPLIER_ID } from "lib/suppliers/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED: JobType[] = [
  "ipon_import",
  "ipon_scrape_details",
  "pcx_import",
  "aggregate_prices",
  "auto_match"
];

/** Same UUIDs as importer scripts — only for `job_runs.supplier_id` / admin UI join. */
function supplierIdForDashboardJob(jobType: JobType): string | null {
  switch (jobType) {
    case "ipon_import":
    case "ipon_scrape_details":
      return IPON_SUPPLIER_ID;
    case "pcx_import":
      return PCX_SUPPLIER_ID;
    default:
      return null;
  }
}

async function isPaused(jobType: string): Promise<boolean> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("job_schedules")
      .select("is_paused")
      .eq("job_type", jobType)
      .maybeSingle();
    return Boolean((data as { is_paused: boolean } | null)?.is_paused);
  } catch {
    return false;
  }
}

async function runByJobType(jobType: JobType) {
  if (jobType === "ipon_import") {
    const { runIponImportProducts } = await import("lib/suppliers/ipon/importProducts");
    return runIponImportProducts();
  }
  if (jobType === "ipon_scrape_details") {
    const { runIponScrapeDetails } = await import("lib/suppliers/ipon/scrapeDetails");
    return runIponScrapeDetails();
  }
  if (jobType === "pcx_import") {
    const { runPcxImportProducts } = await import("lib/suppliers/pcx/importProducts");
    return runPcxImportProducts();
  }
  if (jobType === "aggregate_prices") {
    const { aggregatePrices, wrapAggregatePricesJobResult } = await import("lib/pricing");
    return wrapAggregatePricesJobResult(await aggregatePrices());
  }
  if (jobType === "auto_match") {
    const { runAutoMatch } = await import("lib/auto-match/runAutoMatch");
    return runAutoMatch();
  }
  throw new Error(`Unknown job type: ${jobType}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { jobType?: string };
    const jobType = body.jobType as JobType | undefined;
    if (!jobType || !ALLOWED.includes(jobType)) {
      return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
    }
    if (await isPaused(jobType)) {
      return NextResponse.json(
        { error: `Job '${jobType}' is paused. Unpause it in /admin/jobs first.` },
        { status: 409 }
      );
    }
    const { runId, value } = await withJobRun(
      { jobType, triggeredBy: "manual", supplierId: supplierIdForDashboardJob(jobType) },
      async () => runByJobType(jobType)
    );
    return NextResponse.json({ success: true, runId, result: value });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/jobs/run]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
