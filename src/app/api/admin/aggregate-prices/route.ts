import { NextResponse } from "next/server";
import { aggregatePrices } from "lib/pricing";

/**
 * POST /api/admin/aggregate-prices
 *
 * Runs price aggregation: reads supplier_products + supplier formulas, min acquisition KM,
 * applies tiers / margins / rounding, batch-updates products.price.
 *
 * Returns: { updated, batches, error?, warnings? }
 * Requires: Supabase secret key. Fill `pricing_settings` (and tiers) via /admin/pricing; env PRICING_* only fills missing FX fields.
 */
export async function POST() {
  try {
    const result = await aggregatePrices();
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
