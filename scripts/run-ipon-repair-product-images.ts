/**
 * Re-ingest iPon product images from supplier_products.raw_json → product_images.
 *
 * Examples:
 *   npx tsx scripts/run-ipon-repair-product-images.ts --dry-run
 *   npx tsx scripts/run-ipon-repair-product-images.ts --limit 50
 *   npx tsx scripts/run-ipon-repair-product-images.ts --all
 *   npx tsx scripts/run-ipon-repair-product-images.ts --stale-only
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flagValue(name: string): number | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  const raw = process.argv[idx + 1];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const { runIponRepairProductImages } = await import("../src/lib/suppliers/ipon/repairProductImages");

  const dryRun = hasFlag("--dry-run");
  const all = hasFlag("--all");
  const staleOnly = hasFlag("--stale-only");
  const limit = flagValue("--limit") ?? 0;

  const result = await runIponRepairProductImages({
    dryRun,
    all,
    staleOnly: staleOnly || !all,
    limit
  });

  console.log("iPon repair product images finished:", JSON.stringify(result, null, 2));
  if (result.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
