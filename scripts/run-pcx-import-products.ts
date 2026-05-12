/**
 * PCX category scrape → supplier_products (max 5 offers per run).
 * Run: npx tsx scripts/run-pcx-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/** PCX supplier id (mora odgovarati `PCX_SUPPLIER_ID` u `src/lib/suppliers/pcx/importProducts.ts`). */
const PCX_SUPPLIER_ID = "f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3";

async function main() {
  const { runPcxImportProducts } = await import("../src/lib/suppliers/pcx/importProducts");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "pcx_import", supplierId: PCX_SUPPLIER_ID },
    async () => runPcxImportProducts()
  );

  console.log("PCX importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
