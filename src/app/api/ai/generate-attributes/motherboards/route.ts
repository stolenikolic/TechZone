import { NextResponse } from "next/server";
import { runMotherboardAttributeGenerator } from "lib/ai/attribute-generator";

/**
 * POST /api/ai/generate-attributes/motherboards
 *
 * Generates attributes for all products in the motherboard category (Matične ploče).
 * For each product missing any of: socket, chipset, memory_type, memory_sockets, m2_connectors,
 * calls AI with product name and description, then inserts into product_attributes.
 * Does not overwrite existing attributes. Runs in batches until no products are left.
 *
 * Requires: OPENAI_API_KEY, Supabase service role.
 */
export async function POST() {
  try {
    const result = await runMotherboardAttributeGenerator();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-attributes/motherboards]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
