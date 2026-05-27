/**
 * TEMP — pun FirstShop import samo za jednu kategoriju (kao admin "import ove kategorije").
 * Briši kad završiš debug.
 *
 * Run (iz roota projekta, treba .env.local sa Supabase):
 *   npx tsx -r ./scripts/register-ws.cjs scripts/tmp-run-firstshop-maticne-import.ts
 *
 * URL/key uskladi s onim u supplier_categories:
 *   FIRSTSHOP_LISTING_URL=https://firstshop.hu/hardver/alaplap-c1 ^
 *   FIRSTSHOP_CATEGORY_KEY=maticne-ploce ^
 *   npx tsx -r ./scripts/register-ws.cjs scripts/tmp-run-firstshop-maticne-import.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const listingUrl =
    process.env.FIRSTSHOP_LISTING_URL?.trim() || "https://firstshop.hu/hardver/alaplap-c1";
  const categoryKey = process.env.FIRSTSHOP_CATEGORY_KEY?.trim() || "maticne-ploce";
  const name = process.env.FIRSTSHOP_CATEGORY_NAME?.trim() || "Matične ploče";

  console.log("[tmp-import] categoryKey=", categoryKey);
  console.log("[tmp-import] listingUrl=", listingUrl);

  const { runFirstshopImportForSupplierCategory } = await import(
    "../src/lib/suppliers/firstshop/importProducts"
  );

  const result = await runFirstshopImportForSupplierCategory({
    listingUrl,
    categoryKey,
    name
  });

  console.log("FirstShop single-category import finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
