/**
 * PCX category scrape → supplier_products (max 5 offers per run).
 * Run: npx tsx scripts/run-pcx-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runPcxImportProducts } = await import("../src/lib/suppliers/pcx/importProducts");
  const result = await runPcxImportProducts();
  console.log("PCX importProducts finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
