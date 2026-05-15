/**
 * Cross-supplier enrichment job.
 * Reads spec_snapshot from supplier_products and writes to product_attributes.
 *
 * Usage:
 *   npx tsx scripts/run-enrichment.ts
 *   npx tsx scripts/run-enrichment.ts --category-id=<uuid>
 *   npx tsx scripts/run-enrichment.ts --overwrite
 *   npx tsx scripts/run-enrichment.ts --verbose
 */

import { runEnrichment } from "lib/enrichment/runEnrichment";

const args = process.argv.slice(2);
const categoryId = args.find((a) => a.startsWith("--category-id="))?.split("=")[1];
const overwrite = args.includes("--overwrite");
const verbose = args.includes("--verbose");

runEnrichment({ categoryId, overwrite, verbose })
  .then((result) => {
    console.log("[run-enrichment] Result:", JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error("[run-enrichment] Fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
