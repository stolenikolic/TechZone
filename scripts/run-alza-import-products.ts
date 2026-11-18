/**
 * Alza.hu category listing → supplier_products.
 * Run: npx tsx scripts/run-alza-import-products.ts
 * One category: ALZA_CATEGORY_IDS=18843241 npx tsx -r ./scripts/register-ws.cjs scripts/run-alza-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ALZA_SUPPLIER_ID } from "../src/lib/suppliers/alza/constants";

async function main() {
  const { runAlzaImportProducts } = await import("../src/lib/suppliers/alza/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "alza_import", supplierId: ALZA_SUPPLIER_ID },
    async (handle) => runAlzaImportProducts(handle)
  );

  console.log("Alza importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
