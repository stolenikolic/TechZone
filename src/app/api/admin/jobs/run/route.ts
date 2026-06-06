import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { withJobRun, type JobType } from "lib/jobs/job-runner";
import { IPON_SUPPLIER_ID } from "lib/suppliers/ipon/categories";
import {
  FIRSTSHOP_SUPPLIER_ID,
  KONZOLVILAG_SUPPLIER_ID,
  OAZIS_SUPPLIER_ID,
  PCLAND_SUPPLIER_ID,
  PCX_SUPPLIER_ID
} from "lib/suppliers/registry";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED: JobType[] = [
  "ipon_import",
  "ipon_scrape_details",
  "pcx_import",
  "firstshop_import",
  "pcland_import",
  "oazis_import",
  "konzolvilag_import",
  "aggregate_prices",
  "auto_match",
  "enrichment",
  "apply_value_aliases"
];

/** Same UUIDs as importer scripts — only for `job_runs.supplier_id` / admin UI join. */
function supplierIdForDashboardJob(jobType: JobType): string | null {
  switch (jobType) {
    case "ipon_import":
    case "ipon_scrape_details":
      return IPON_SUPPLIER_ID;
    case "pcx_import":
      return PCX_SUPPLIER_ID;
    case "firstshop_import":
      return FIRSTSHOP_SUPPLIER_ID;
    case "pcland_import":
      return PCLAND_SUPPLIER_ID;
    case "oazis_import":
      return OAZIS_SUPPLIER_ID;
    case "konzolvilag_import":
      return KONZOLVILAG_SUPPLIER_ID;
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

async function runJob(
  jobType: JobType,
  options?: {
    enrichmentCategoryId?: string;
    enrichmentOverwrite?: boolean;
    applyValueAliasesCategoryId?: string;
    applyValueAliasesAttributeId?: string;
    iponScrapeRunUntilQueueEmpty?: boolean;
  }
) {
  if (jobType === "ipon_import") {
    const { runIponImportProducts } = await import("lib/suppliers/ipon/importProducts");
    return runIponImportProducts();
  }
  if (jobType === "ipon_scrape_details") {
    const { runIponScrapeDetails } = await import("lib/suppliers/ipon/scrapeDetails");
    return runIponScrapeDetails({
      runUntilQueueEmpty: options?.iponScrapeRunUntilQueueEmpty ?? false
    });
  }
  if (jobType === "pcx_import") {
    const { runPcxImportProducts } = await import("lib/suppliers/pcx/importProducts");
    return runPcxImportProducts();
  }
  if (jobType === "firstshop_import") {
    const { runFirstshopImportProducts } = await import("lib/suppliers/firstshop/importProducts");
    return runFirstshopImportProducts();
  }
  if (jobType === "pcland_import") {
    const { runPclandImportProducts } = await import("lib/suppliers/pcland/importProducts");
    return runPclandImportProducts();
  }
  if (jobType === "oazis_import") {
    const { runOazisImportProducts } = await import("lib/suppliers/oazis/importProducts");
    return runOazisImportProducts();
  }
  if (jobType === "konzolvilag_import") {
    const { runKonzolvilagImportProducts } = await import("lib/suppliers/konzolvilag/importProducts");
    return runKonzolvilagImportProducts();
  }
  if (jobType === "aggregate_prices") {
    const { aggregatePrices, wrapAggregatePricesJobResult } = await import("lib/pricing");
    return wrapAggregatePricesJobResult(await aggregatePrices());
  }
  if (jobType === "auto_match") {
    const { runAutoMatch } = await import("lib/auto-match/runAutoMatch");
    return runAutoMatch();
  }
  if (jobType === "enrichment") {
    const { runEnrichment } = await import("lib/enrichment/runEnrichment");
    return runEnrichment({
      categoryId: options?.enrichmentCategoryId,
      overwrite: options?.enrichmentOverwrite ?? false
    });
  }
  if (jobType === "apply_value_aliases") {
    const { applyValueAliasesToProducts } = await import("lib/attributes/apply-value-aliases-to-products");
    const { createSupabaseServiceClient } = await import("utils/supabase");
    const categoryId = options?.applyValueAliasesCategoryId;
    if (!categoryId) throw new Error("applyValueAliasesCategoryId is required.");
    const supabase = createSupabaseServiceClient();
    return applyValueAliasesToProducts(supabase, {
      categoryId,
      attributeId: options?.applyValueAliasesAttributeId
    });
  }
  throw new Error(`Unknown job type: ${jobType}`);
}

export async function POST(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      jobType?: string;
      enrichmentCategoryId?: string;
      enrichmentOverwrite?: boolean;
      applyValueAliasesCategoryId?: string;
      applyValueAliasesAttributeId?: string;
      iponScrapeRunUntilQueueEmpty?: boolean;
    };
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
      async () =>
        runJob(jobType, {
          enrichmentCategoryId: body.enrichmentCategoryId,
          enrichmentOverwrite: body.enrichmentOverwrite,
          applyValueAliasesCategoryId: body.applyValueAliasesCategoryId,
          applyValueAliasesAttributeId: body.applyValueAliasesAttributeId,
          iponScrapeRunUntilQueueEmpty: body.iponScrapeRunUntilQueueEmpty
        })
    );
    return NextResponse.json({ success: true, runId, result: value });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/jobs/run]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
