/**
 * FirstShop category scrape → supplier_products.
 * Run: npx tsx scripts/run-firstshop-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { FIRSTSHOP_SUPPLIER_ID } from "../src/lib/suppliers/firstshop/constants";

async function main() {
  const { runFirstshopImportProducts } = await import("../src/lib/suppliers/firstshop/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "firstshop_import", supplierId: FIRSTSHOP_SUPPLIER_ID },
    async () => runFirstshopImportProducts()
  );

  console.log("FirstShop importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
