import { NextResponse } from "next/server";
import { aggregatePrices, wrapAggregatePricesJobResult } from "lib/pricing";
import { withJobRun } from "lib/jobs/job-runner";
import { guardAdminApi } from "lib/auth/admin-route";

/**
 * POST /api/admin/aggregate-prices
 *
 * Runs price aggregation: reads supplier_products + supplier formulas, min acquisition KM,
 * applies tiers / margins / rounding, batch-updates products.price.
 *
 * Returns: { updated, batches, error?, warnings? }
 * Requires: Supabase secret key. Fill `pricing_settings` (and tiers) via /admin/pricing; env PRICING_* only fills missing FX fields.
 *
 * The full run is logged into `job_runs` via `withJobRun`. Failures still return HTTP 500
 * with the original payload shape so existing UI callers keep working.
 */
export async function POST() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { value: result } = await withJobRun(
      { jobType: "aggregate_prices", triggeredBy: "manual" },
      async () => wrapAggregatePricesJobResult(await aggregatePrices())
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[aggregate-prices]", message);
    return NextResponse.json(
      { updated: 0, batches: 0, error: message },
      { status: 500 }
    );
  }
}
