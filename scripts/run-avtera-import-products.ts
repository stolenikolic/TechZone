/**
 * Avtera XML import (novi artikli).
 * Run: npx tsx scripts/run-avtera-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runAvteraImportProducts } = await import("../src/lib/suppliers/avtera/importProducts");
  const { AVTERA_SUPPLIER_ID } = await import("../src/lib/suppliers/avtera/constants");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value } = await withJobRun(
    { jobType: "avtera_import", supplierId: AVTERA_SUPPLIER_ID },
    async () => runAvteraImportProducts()
  );

  console.log("Avtera import finished:", JSON.stringify(value, null, 2));
  if (!value.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
