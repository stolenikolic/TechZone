/**
 * Parser smoke test (no DB). Run: npx tsx scripts/test-firstshop-parsers.ts
 */
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseCategoryListingHtml,
  parseMaxListingPage,
  parseProductDetailHtml,
  extractCikkszamFromDetailHtml,
  extractFirstshopProductIdFromUrl,
  resolveFirstshopSupplierProductId
} from "../src/lib/suppliers/firstshop/importProducts";

function main() {
  const listPath = join(tmpdir(), "fs-list-p1.html");
  const pdpPath = join(tmpdir(), "fs-pdp.html");
  const list = readFileSync(listPath, "utf8");
  const items = parseCategoryListingHtml(list);
  if (items.length < 10) throw new Error(`Expected >=10 listing items, got ${items.length}`);
  const maxPage = parseMaxListingPage(list);
  if (maxPage < 2) throw new Error(`Expected maxPage >=2, got ${maxPage}`);

  const pdp = readFileSync(pdpPath, "utf8");
  const url = "https://firstshop.hu/amd-ryzen-9-5950x-p43289";
  const detail = parseProductDetailHtml(pdp, url);
  const cikkszam = extractCikkszamFromDetailHtml(pdp);
  if (cikkszam !== "100-100000059WOF") throw new Error(`Bad cikkszam: ${cikkszam}`);
  if (detail.price !== 122030) throw new Error(`Bad price: ${detail.price}`);
  if (detail.specRows.length < 5) throw new Error(`Bad spec count: ${detail.specRows.length}`);
  if (!detail.productName?.includes("5950X")) throw new Error(`Bad name: ${detail.productName}`);

  const id = resolveFirstshopSupplierProductId(detail);
  if (id !== "100-100000059WOF") throw new Error(`Bad supplier_product_id: ${id}`);
  const urlId = extractFirstshopProductIdFromUrl(url);
  if (urlId !== "43289") throw new Error(`Bad url id: ${urlId}`);

  console.log("OK", { items: items.length, maxPage, cikkszam, price: detail.price, specs: detail.specRows.length });
}

main();
