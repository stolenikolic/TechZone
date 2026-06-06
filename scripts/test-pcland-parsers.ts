/**
 * Parser smoke test (no DB). Run: npx tsx scripts/test-pcland-parsers.ts
 */
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseCategoryListingHtml,
  parseMaxListingPage,
  parseProductDetailHtml,
  extractCikkszamFromDetailHtml,
  extractPclandProductIdFromUrl,
  resolvePclandSupplierProductId,
  parseVonalkodEan,
  buildCategoryListUrl
} from "../src/lib/suppliers/pcland/importProducts";
import { computePclandDeliveryDays } from "../src/lib/suppliers/pcland/delivery-days";

function main() {
  const listPath = join(tmpdir(), "pcl-list-p1.html");
  const pdpPath = join(tmpdir(), "pcl-pdp.html");
  const list = readFileSync(listPath, "utf8");
  const items = parseCategoryListingHtml(list);
  if (items.length < 10) throw new Error(`Expected >=10 listing items, got ${items.length}`);
  const maxPage = parseMaxListingPage(list);
  if (maxPage < 2) throw new Error(`Expected maxPage >=2, got ${maxPage}`);

  const page2 = buildCategoryListUrl(
    "https://pcland.hu/termekek-158/szamitogep-alkatresz-160/processzor-397",
    2
  );
  if (!page2.includes("page=2")) throw new Error(`Bad page2 url: ${page2}`);

  const pdp = readFileSync(pdpPath, "utf8");
  const url = "https://pcland.hu/amd-ryzen-5-5600x-37ghz-am4-box-48979";
  const detail = parseProductDetailHtml(pdp, url);
  const cikkszam = extractCikkszamFromDetailHtml(pdp);
  if (cikkszam !== "10003982") throw new Error(`Bad cikkszam: ${cikkszam}`);
  if (detail.price !== 54660) throw new Error(`Bad price: ${detail.price}`);
  if (detail.specRows.length < 5) throw new Error(`Bad spec count: ${detail.specRows.length}`);
  if (!detail.productName?.includes("5600X")) throw new Error(`Bad name: ${detail.productName}`);

  const ean = parseVonalkodEan(pdp);
  if (ean !== "730143312042") throw new Error(`Bad ean: ${ean}`);
  if (detail.mpn !== "100-100000065BOX") throw new Error(`Bad mpn: ${detail.mpn}`);

  const deliveryDays = computePclandDeliveryDays(pdp);
  if (deliveryDays < 1 || deliveryDays > 7) {
    throw new Error(`Unexpected delivery_days for Központi raktáron: ${deliveryDays}`);
  }

  const id = resolvePclandSupplierProductId(detail);
  if (id !== "10003982") throw new Error(`Bad supplier_product_id: ${id}`);
  const urlId = extractPclandProductIdFromUrl(url);
  if (urlId !== "48979") throw new Error(`Bad url id: ${urlId}`);

  console.log("OK", {
    items: items.length,
    maxPage,
    cikkszam,
    price: detail.price,
    ean,
    mpn: detail.mpn,
    deliveryDays,
    specs: detail.specRows.length
  });
}

main();
