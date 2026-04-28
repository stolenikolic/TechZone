import { importCategory } from "lib/suppliers/ipon/importProducts";

/** IPON group 205 = SSD. */
const SUPPLIER_CATEGORY_ID = 205;

/** Database category id for SSD. */
const INTERNAL_CATEGORY_ID = "660c7768-4a5b-47bb-893b-55adc554cd7b";

/**
 * Import SSD from IPON group 205.
 * Paginates until no more products; new products get images processed and stored.
 * POST this route to run the import.
 */
export async function POST() {
  const result = await importCategory(SUPPLIER_CATEGORY_ID, INTERNAL_CATEGORY_ID);
  return Response.json(result);
}
