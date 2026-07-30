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

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runEnrichment } = await import("lib/enrichment/runEnrichment");

  const args = process.argv.slice(2);
  const categoryId = args.find((a) => a.startsWith("--category-id="))?.split("=")[1];
  const overwrite = args.includes("--overwrite");
  const verbose = args.includes("--verbose");

  const result = await runEnrichment({ categoryId, overwrite, verbose });
  console.log("[run-enrichment] Result:", JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("[run-enrichment] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
