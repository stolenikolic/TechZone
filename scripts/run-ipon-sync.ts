/**
 * Redom: API import svih kategorija iz `IPON_CATEGORIES`, pauza, zatim jedan batch scrape detalja (MPN/EAN/spec).
 * Run: npx tsx scripts/run-ipon-sync.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runIponImportProducts, IPON_SUPPLIER_ID } = await import(
    "../src/lib/suppliers/ipon/importProducts"
  );
  const { runIponScrapeDetails } = await import("../src/lib/suppliers/ipon/scrapeDetails");
  const { sleep } = await import("../src/lib/suppliers/ipon/ipon-fetch");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const gap = Number(process.env.IPON_SYNC_GAP_MS ?? "4000");

  console.log("=== iPon import (API) ===");
  const { value: imp } = await withJobRun(
    { jobType: "ipon_import", supplierId: IPON_SUPPLIER_ID },
    async () => runIponImportProducts()
  );
  console.log("Import:", JSON.stringify(imp, null, 2));

  console.log(`\nPauza ${gap}ms pre scrape detalja…\n`);
  await sleep(Number.isFinite(gap) ? gap : 4000);

  console.log("=== iPon scrape (JSON-LD) ===");
  const { value: scr } = await withJobRun(
    { jobType: "ipon_scrape_details", supplierId: IPON_SUPPLIER_ID },
    async () => runIponScrapeDetails()
  );
  console.log("Scrape:", JSON.stringify(scr, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
