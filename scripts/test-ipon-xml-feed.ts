/**
 * Unit tests for iPon XML feed parser. Run: npx tsx scripts/test-ipon-xml-feed.ts
 */
import assert from "node:assert/strict";
import path from "node:path";
import {
  extractIponIdFromTermekLink,
  parseIponDeliveryFromIdo,
  parseIponXmlFeedCreatedAt,
  parseIponXmlFeedFromFile,
  parseTermekBlock
} from "../src/lib/suppliers/ipon/xmlFeed";
import { needsPicturesIngest, PICTURES_INGESTED_FROM_KEY } from "../src/lib/suppliers/ipon/ipon-product-images";

const sampleLink =
  "https://ipon.hu/shop/termek/d-link-des-1024d-24-port-fast-ethernet-unmanaged-desktop-switch/15260?utm_source=argep&utm_medium=referral&utm_campaign=argep&utm_content=15260";

assert.equal(extractIponIdFromTermekLink(sampleLink), "15260");
assert.equal(extractIponIdFromTermekLink("https://ipon.hu/shop/termek/intel-core-i5-12400/99001"), "99001");
assert.equal(extractIponIdFromTermekLink(""), null);

assert.equal(parseIponDeliveryFromIdo("9 nap"), 9);
assert.equal(parseIponDeliveryFromIdo("0 nap"), 0);
assert.equal(parseIponDeliveryFromIdo(""), null);
assert.equal(parseIponDeliveryFromIdo(undefined), null);

const feedHead = `<?xml version="1.0" encoding="UTF-8"?>
<!-- CreatedAt: 2026-06-15 11:25:06 -->
<termeklista>`;
assert.equal(parseIponXmlFeedCreatedAt(feedHead), "2026-06-15 11:25:06");
assert.equal(parseIponXmlFeedCreatedAt("<termeklista>"), null);

assert.equal(needsPicturesIngest(null, "https://a/img.jpg"), true);
assert.equal(
  needsPicturesIngest({ pictures: ["https://a/img.jpg"], [PICTURES_INGESTED_FROM_KEY]: "https://a/img.jpg" }, "https://a/img.jpg"),
  false
);
assert.equal(
  needsPicturesIngest({ pictures: ["https://a/new.jpg"], [PICTURES_INGESTED_FROM_KEY]: "https://a/old.jpg" }, "https://a/new.jpg"),
  true
);

const block = `<termek>
  <ar>27189</ar>
  <termeklink><![CDATA[${sampleLink}]]></termeklink>
  <ido>9 nap</ido>
</termek>`;

const parsed = parseTermekBlock(block);
assert.ok(parsed);
assert.equal(parsed!.id, "15260");
assert.equal(parsed!.entry.price, 27189);
assert.equal(parsed!.entry.deliveryDays, 9);

const badBlock = `<termek><ar></ar><termeklink>https://ipon.hu/shop/x/1</termeklink></termek>`;
assert.equal(parseTermekBlock(badBlock), null);

async function testFixture() {
  const fixturePath = path.resolve(process.cwd(), "fixtures/ipon-xml-sample.xml");
  const map = await parseIponXmlFeedFromFile(fixturePath);
  assert.equal(map.size, 2, "fixture: 2 valid termek (one has no price)");
  assert.equal(map.get("15260")?.price, 27189);
  assert.equal(map.get("99001")?.deliveryDays, 0);
}

testFixture()
  .then(() => {
    console.log("test-ipon-xml-feed: OK");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
