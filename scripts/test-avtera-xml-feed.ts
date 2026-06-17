/**
 * Unit tests for Avtera XML feed parser. Run: npx tsx scripts/test-avtera-xml-feed.ts
 */
import assert from "node:assert/strict";
import path from "path";
import { resolveAvteraPrice } from "../src/lib/suppliers/avtera/parsePrice";
import { deliveryDaysForZaloga, isAvteraActiveFromZaloga } from "../src/lib/suppliers/avtera/parseStock";
import {
  assertAvteraFeedGuard,
  filterProductsByCategory,
  parseAvteraXmlFeedFromFile,
  parseIzdelekBlock
} from "../src/lib/suppliers/avtera/xmlFeed";

const msBlock = `<izdelek st="2">
  <izdelekID>200001</izdelekID>
  <VendorItemNo.>LOG-M185</VendorItemNo.>
  <izdelekIme><![CDATA[ Logitech M185 ]]></izdelekIme>
  <cenaAkcijska>18.5</cenaAkcijska>
  <nabavnaCena>20</nabavnaCena>
  <kategorija id="MS">Miševi</kategorija>
  <blagovnaZnamka id="L1">Logitech</blagovnaZnamka>
  <zaloga>5</zaloga>
  <EAN>5099206042205</EAN>
</izdelek>`;

const parsed = parseIzdelekBlock(msBlock);
assert.ok(parsed);
assert.equal(parsed!.izdelekID, "200001");
assert.equal(parsed!.vendorItemNo, "LOG-M185");
assert.equal(parsed!.kategorijaId, "MS");
assert.equal(resolveAvteraPrice(parsed!), 18.5);
assert.equal(isAvteraActiveFromZaloga(parsed!.zaloga), true);
assert.equal(deliveryDaysForZaloga(parsed!.zaloga), 1);

const noMpnBlock = `<izdelek st="3">
  <izdelekID>200002</izdelekID>
  <VendorItemNo.></VendorItemNo.>
  <nabavnaCena>9.5</nabavnaCena>
  <kategorija id="MS">Miševi</kategorija>
  <zaloga>0</zaloga>
  <EAN>1234567890123</EAN>
</izdelek>`;
const noMpn = parseIzdelekBlock(noMpnBlock);
assert.ok(noMpn);
assert.equal(noMpn!.vendorItemNo, null);
assert.equal(isAvteraActiveFromZaloga(noMpn!.zaloga), false);

async function testFixture() {
  const fixturePath = path.resolve(process.cwd(), "fixtures/avtera-xml-sample.xml");
  const map = await parseAvteraXmlFeedFromFile(fixturePath);
  assert.equal(map.size, 3);
  const ms = filterProductsByCategory(map, "MS");
  assert.equal(ms.length, 2);
  assert.equal(map.get("200001")?.brandName, "Logitech");
  assert.equal(resolveAvteraPrice(map.get("200001")!), 18.5);
  assert.equal(resolveAvteraPrice(map.get("200002")!), 9.5);
}

assert.throws(() => assertAvteraFeedGuard(3, 1000), /Guard: feed ima samo 3 stavki/);
assert.doesNotThrow(() => assertAvteraFeedGuard(1000, 1000));

async function runTests() {
  await testFixture();
}

runTests()
  .then(() => {
    console.log("test-avtera-xml-feed: OK");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
