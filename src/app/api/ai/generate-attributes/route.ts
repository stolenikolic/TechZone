import { NextResponse } from "next/server";
import { runAttributeGenerator } from "lib/ai/attribute-generator";

/**
 * POST /api/ai/generate-attributes
 *
 * Runs the generic AI attribute generator: fetches products without attributes,
 * gets category attributes per product, calls AI to generate values, inserts into product_attributes.
 * Processes one batch (20 products) per request. Call repeatedly to process more.
 *
 * Requires: OPENAI_API_KEY, Supabase service role.
 */
export async function POST() {
  try {
    const result = await runAttributeGenerator();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-attributes]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
