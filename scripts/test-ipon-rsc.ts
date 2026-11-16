/**
 * iPon RSC flight parser.
 * Run: npx tsx scripts/test-ipon-rsc.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isIponEnglishProductUrl,
  parseIponRscFlight,
  productIdFromIponUrl
} from "../src/lib/suppliers/ipon/rscProduct";

const flight = fs.readFileSync(path.resolve("fixtures/ipon-rsc-sample.txt"), "utf8");
const parsed = parseIponRscFlight(flight, "2213319");

assert.deepEqual(
  parsed.specs.map((row) => `${row.name}=${row.value}`),
  ["CPU=none", "Integrated VGA=Yes", "Integrated VGA=Integrated in CPU"]
);
assert.deepEqual(parsed.images, [
  "https://media.icdn.hu/product/a.webp",
  "https://media.icdn.hu/product/b.webp"
]);
assert.equal(parsed.manufacturerUrl, "https://www.msi.com/Motherboard/PRO-B650-S-WIFI");
assert.equal(parsed.images.includes("https://media.icdn.hu/product/other.webp"), false);

assert.equal(
  isIponEnglishProductUrl("https://iponcomp.com/shop/product/msi-pro-b650-s-wifi/2213319"),
  true
);
assert.equal(isIponEnglishProductUrl("https://ipon.hu/shop/termek/msi-pro-b650-s-wifi/2213319"), false);
assert.equal(isIponEnglishProductUrl("https://iponcomp.com/shop/product/2213319"), false);
assert.equal(productIdFromIponUrl("https://iponcomp.com/shop/product/msi-pro-b650-s-wifi/2213319"), "2213319");

const empty = parseIponRscFlight("1:{}\n");
assert.deepEqual(empty.specs, []);
assert.deepEqual(empty.images, []);
assert.equal(empty.manufacturerUrl, null);

console.log("test-ipon-rsc: OK");
