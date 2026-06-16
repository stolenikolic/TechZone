/**
 * ComTrade price sync — /Price/items.
 * Run: npx tsx scripts/run-comtrade-price-sync.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { COMTRADE_SUPPLIER_ID } from "../src/lib/suppliers/comtrade/constants";

async function main() {
  const { runComtradePriceSync } = await import("../src/lib/suppliers/comtrade/priceSync");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "comtrade_price_sync", supplierId: COMTRADE_SUPPLIER_ID },
    async () => runComtradePriceSync()
  );

  console.log("ComTrade price sync finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
