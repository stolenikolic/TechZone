import { importCategory } from "lib/suppliers/ipon/importProducts";

/** IPON group 174 = Hard Diskovi. */
const SUPPLIER_CATEGORY_ID = 174;

/** Database category id for Hard Diskovi. */
const INTERNAL_CATEGORY_ID = "0611a4e7-9f63-4321-b474-743f55e61c6e";

/**
 * Import Hard Diskovi from IPON group 174.
 * Paginates until no more products; new products get images processed and stored.
 * POST this route to run the import.
 */
export async function POST() {
  const result = await importCategory(SUPPLIER_CATEGORY_ID, INTERNAL_CATEGORY_ID);
  return Response.json(result);
}
