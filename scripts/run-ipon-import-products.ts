/**
 * iPon API import (sve kategorije iz IPON_CATEGORIES).
 * Run: npx tsx scripts/run-ipon-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runIponImportProducts, IPON_SUPPLIER_ID } = await import(
    "../src/lib/suppliers/ipon/importProducts"
  );
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value } = await withJobRun(
    { jobType: "ipon_import", supplierId: IPON_SUPPLIER_ID },
    async () => runIponImportProducts()
  );

  console.log("iPon importProducts finished:", JSON.stringify(value, null, 2));
  if (!value.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
