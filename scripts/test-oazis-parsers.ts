/**
 * Parser smoke test (no DB). Run: npx tsx scripts/test-oazis-parsers.ts
 */
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseCategoryListingHtml,
  parseMaxListingPage,
  parseProductDetailHtml,
  extractTermekkodFromDetailHtml,
  extractOazisProductIdFromUrl,
  resolveOazisSupplierProductId,
  buildCategoryListUrl
} from "../src/lib/suppliers/oazis/importProducts";
import { parseOazisDeliveryDays, parseOazisWarrantyMonths } from "../src/lib/suppliers/oazis/delivery-days";

function main() {
  const listPath = join(tmpdir(), "oazis-list-p1.html");
  const pdpPath = join(tmpdir(), "oazis-pdp.html");
  const list = readFileSync(listPath, "utf8");
  const items = parseCategoryListingHtml(list);
  if (items.length < 10) throw new Error(`Expected >=10 listing items, got ${items.length}`);
  const maxPage = parseMaxListingPage(list);
  if (maxPage < 2) throw new Error(`Expected maxPage >=2, got ${maxPage}`);

  const page2 = buildCategoryListUrl("https://oaziscomputer.hu/kategoria/27/processzor", 2);
  if (!page2.endsWith("/processzor/2")) throw new Error(`Bad page2 url: ${page2}`);

  const pdp = readFileSync(pdpPath, "utf8");
  const url =
    "https://oaziscomputer.hu/termek/30800/amd-ryzen-7-8700g-100-100001236box";
  const detail = parseProductDetailHtml(pdp, url);
  const termekkod = extractTermekkodFromDetailHtml(pdp);
  if (termekkod !== "100-100001236BOX") throw new Error(`Bad termekkod: ${termekkod}`);
  if (detail.price !== 90800) throw new Error(`Bad price: ${detail.price}`);
  if (detail.specRows.length < 5) throw new Error(`Bad spec count: ${detail.specRows.length}`);
  if (!detail.productName?.includes("8700G")) throw new Error(`Bad name: ${detail.productName}`);

  const deliveryDays = parseOazisDeliveryDays(detail.availabilityLabel);
  if (deliveryDays !== 2) throw new Error(`Bad delivery_days: ${deliveryDays}`);

  const id = resolveOazisSupplierProductId(detail);
  if (id !== "100-100001236BOX") throw new Error(`Bad supplier_product_id: ${id}`);
  const urlId = extractOazisProductIdFromUrl(url);
  if (urlId !== "30800") throw new Error(`Bad url id: ${urlId}`);

  const warranty = parseOazisWarrantyMonths(pdp);

  console.log("OK", {
    items: items.length,
    maxPage,
    termekkod,
    price: detail.price,
    mpn: detail.mpn,
    deliveryDays,
    warranty,
    specs: detail.specRows.length
  });
}

main();
