/**
 * iPon API sync (bez HTML scrapinga).
 * Run: npx tsx scripts/run-ipon-import-products.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runIponImportProducts } = await import("../src/lib/suppliers/ipon/importProducts");
  const result = await runIponImportProducts();
  console.log("iPon importProducts finished:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
