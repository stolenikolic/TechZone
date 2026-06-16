/**
 * ComTrade API import → supplier_products (novi offer-i).
 * Run: npx tsx scripts/run-comtrade-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { COMTRADE_SUPPLIER_ID } from "../src/lib/suppliers/comtrade/constants";

async function main() {
  const { runComtradeImportProducts } = await import("../src/lib/suppliers/comtrade/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "comtrade_import", supplierId: COMTRADE_SUPPLIER_ID },
    async () => runComtradeImportProducts()
  );

  console.log("ComTrade import finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
