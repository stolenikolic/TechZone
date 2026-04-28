import { importCategory } from "lib/suppliers/ipon/importProducts";

/** IPON group 79 = motherboards (same fetch/pagination as CPUs). */
const SUPPLIER_CATEGORY_ID = 79;

/** Database category id for motherboards – set to your motherboards category UUID. */
const INTERNAL_CATEGORY_ID = "bc6b63f8-ac4e-44cc-82e6-030cebee187d";

/**
 * Import motherboards from IPON group 79 using the same logic as CPU import.
 * POST this route to run the import.
 */
export async function POST() {
  const result = await importCategory(SUPPLIER_CATEGORY_ID, INTERNAL_CATEGORY_ID);
  return Response.json(result);
}
