/**
 * iPon JSON-LD detalji (MPN/EAN/spec). Red uključuje i nedostajuće atribute (prema mapi u scrapeDetails).
 * Run: npx tsx scripts/run-ipon-scrape-details.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { getIponCategoryInternalIdByName, IPON_SUPPLIER_ID } = await import(
    "../src/lib/suppliers/ipon/categories"
  );
  const { runIponScrapeDetails } = await import("../src/lib/suppliers/ipon/scrapeDetails");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const catName = process.env.IPON_SCRAPE_CATEGORY?.trim();
  let categoryId: string | undefined;
  if (catName) {
    const id = getIponCategoryInternalIdByName(catName);
    if (!id) {
      throw new Error(`IPON_SCRAPE_CATEGORY="${catName}" — nepoznata kategorija u IPON_CATEGORIES (categories.ts).`);
    }
    categoryId = id;
  }

  const runUntil =
    process.env.IPON_SCRAPE_UNTIL_EMPTY === "1" || /^true$/i.test(process.env.IPON_SCRAPE_UNTIL_EMPTY ?? "");
  const dryRun = process.env.IPON_SCRAPE_DRY_RUN === "1" || /^true$/i.test(process.env.IPON_SCRAPE_DRY_RUN ?? "");

  const { value: result } = await withJobRun(
    {
      jobType: "ipon_scrape_details",
      supplierId: IPON_SUPPLIER_ID,
      initialSummary: { categoryId: categoryId ?? null, runUntilQueueEmpty: runUntil, dryRun }
    },
    async () =>
      runIponScrapeDetails({
        categoryId,
        runUntilQueueEmpty: runUntil,
        dryRun
      })
  );
  console.log("iPon scrapeDetails finished:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
