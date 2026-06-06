/**
 * Parser smoke test (no DB). Run: npx tsx scripts/test-konzolvilag-parsers.ts
 */
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseCategoryListingHtml,
  parseMaxListingPage,
  parseProductDetailHtml,
  extractTermekAzonositoFromDetailHtml,
  extractGyartoCikkszamFromDetailHtml,
  resolveKonzolvilagSupplierProductId,
  parseKonzolvilagBruttoHufPrice,
  buildCategoryListUrl
} from "../src/lib/suppliers/konzolvilag/importProducts";

function main() {
  const listPath = join(tmpdir(), "kv-list-p1.html");
  const pdpPath = join(tmpdir(), "kv-pdp.html");
  const list = readFileSync(listPath, "utf8");
  const items = parseCategoryListingHtml(list);
  if (items.length < 20) throw new Error(`Expected >=20 listing items, got ${items.length}`);
  const maxPage = parseMaxListingPage(list, 1);
  if (maxPage < 2) throw new Error(`Expected maxPage >=2, got ${maxPage}`);

  const page2 = buildCategoryListUrl("https://www.konzolvilag.hu/pc/hardver/processzor", 2);
  if (!page2.endsWith("/oldal-2")) throw new Error(`Bad page2 url: ${page2}`);

  const saleItem = items.find((i) => i.name.includes("5600X"));
  if (!saleItem?.listPrice || saleItem.listPrice !== 50090) {
    throw new Error(`Bad 5600X sale price: ${saleItem?.listPrice}`);
  }

  const pdp = readFileSync(pdpPath, "utf8");
  const url =
    "https://www.konzolvilag.hu/pc/amd-ryzen-7-8700g-am5-box-100-100001236box";
  const detail = parseProductDetailHtml(pdp, url);
  const termekAzonosito = extractTermekAzonositoFromDetailHtml(pdp);
  if (termekAzonosito !== "200212168") throw new Error(`Bad termek azonosito: ${termekAzonosito}`);
  if (detail.price !== 118599) throw new Error(`Bad price: ${detail.price}`);
  if (detail.specRows.length < 5) throw new Error(`Bad spec count: ${detail.specRows.length}`);
  if (!detail.productName?.includes("8700G")) throw new Error(`Bad name: ${detail.productName}`);

  const gyarto = extractGyartoCikkszamFromDetailHtml(pdp);
  if (gyarto !== "100-100001236BOX") throw new Error(`Bad gyarto: ${gyarto}`);
  if (detail.mpn !== "100-100001236BOX") throw new Error(`Bad mpn: ${detail.mpn}`);
  if (detail.deliveryDays !== 0) throw new Error(`Bad delivery_days: ${detail.deliveryDays}`);

  const id = resolveKonzolvilagSupplierProductId(detail);
  if (id !== "200212168") throw new Error(`Bad supplier_product_id: ${id}`);

  const priceOnly = parseKonzolvilagBruttoHufPrice(pdp);
  if (priceOnly !== 118599) throw new Error(`Bad parseKonzolvilagBruttoHufPrice: ${priceOnly}`);

  console.log("OK", {
    items: items.length,
    maxPage,
    termekAzonosito,
    gyarto,
    price: detail.price,
    mpn: detail.mpn,
    deliveryDays: detail.deliveryDays,
    sale5600: saleItem.listPrice,
    specs: detail.specRows.length
  });
}

main();
