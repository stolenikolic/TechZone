/**
 * PCLand category scrape → supplier_products.
 * Run: npx tsx scripts/run-pcland-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PCLAND_SUPPLIER_ID } from "../src/lib/suppliers/pcland/constants";

async function main() {
  const { runPclandImportProducts } = await import("../src/lib/suppliers/pcland/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "pcland_import", supplierId: PCLAND_SUPPLIER_ID },
    async () => runPclandImportProducts()
  );

  console.log("PCLand importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
