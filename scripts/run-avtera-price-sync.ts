/**
 * Avtera XML price sync (cijene, zaliha, deaktivacija).
 * Run: npx tsx scripts/run-avtera-price-sync.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runAvteraPriceSync } = await import("../src/lib/suppliers/avtera/priceSync");
  const { AVTERA_SUPPLIER_ID } = await import("../src/lib/suppliers/avtera/constants");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value } = await withJobRun(
    { jobType: "avtera_price_sync", supplierId: AVTERA_SUPPLIER_ID },
    async () => runAvteraPriceSync()
  );

  console.log("Avtera price sync finished:", JSON.stringify(value, null, 2));
  if (!value.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
