/**
 * ComTrade enrich — backfill spec_snapshot.
 * Run: npx tsx scripts/run-comtrade-enrich.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { COMTRADE_SUPPLIER_ID } from "../src/lib/suppliers/comtrade/constants";

async function main() {
  const { runComtradeEnrich } = await import("../src/lib/suppliers/comtrade/enrich");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: result } = await withJobRun(
    { jobType: "comtrade_enrich", supplierId: COMTRADE_SUPPLIER_ID },
    async () => runComtradeEnrich()
  );

  console.log("ComTrade enrich finished:", JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
