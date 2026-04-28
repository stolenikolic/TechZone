import { NextResponse } from "next/server";
import { aggregatePrices } from "lib/pricing";

/**
 * POST /api/admin/aggregate-prices
 *
 * Runs price aggregation: reads supplier_products, converts to KM, computes min
 * price per product, batch-updates products.price. Idempotent; safe to call
 * repeatedly or after supplier sync.
 *
 * Returns: { updated, batches, error? }
 * Requires: Supabase secret key. Conversion uses PRICING_* env vars (optional).
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
