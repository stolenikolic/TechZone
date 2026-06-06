/**
 * Konzolvilág category scrape → supplier_products.
 * Run: npx tsx scripts/run-konzolvilag-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { KONZOLVILAG_SUPPLIER_ID } from "../src/lib/suppliers/konzolvilag/constants";

async function main() {
  const { runKonzolvilagImportProducts } = await import(
    "../src/lib/suppliers/konzolvilag/importProducts"
  );
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "konzolvilag_import", supplierId: KONZOLVILAG_SUPPLIER_ID },
    async () => runKonzolvilagImportProducts()
  );

  console.log("Konzolvilág importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
