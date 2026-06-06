/**
 * Oázis category scrape → supplier_products.
 * Run: npx tsx scripts/run-oazis-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { OAZIS_SUPPLIER_ID } from "../src/lib/suppliers/oazis/constants";

async function main() {
  const { runOazisImportProducts } = await import("../src/lib/suppliers/oazis/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "oazis_import", supplierId: OAZIS_SUPPLIER_ID },
    async () => runOazisImportProducts()
  );

  console.log("Oázis importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
