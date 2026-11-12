/**
 * Classification, feed URL and gallery parser tests.
 * Run: npx tsx scripts/test-ipon-classify.ts
 */
import assert from "node:assert/strict";
import { classifyFeedProduct, type IponMappedCategory } from "../src/lib/suppliers/ipon/classifyFeedProduct";
import { extractIcdnImageUrls, galleryUrlsExcludingMain } from "../src/lib/suppliers/ipon/icdnImages";
import { parseIponListProductsPage } from "../src/lib/suppliers/ipon/listMembership";
import {
  findProductOpen,
  parseIponProductFeedFromString,
  parseProductBlock,
  toIponEnglishProductUrl
} from "../src/lib/suppliers/ipon/productFeed";
import {
  isManualListImportComplete,
  mergeManualListProduct,
  mergeManualRawJson,
  parseIponManualListPage
} from "../src/lib/suppliers/ipon/manualListMerge";
import { parseIponTrackingProducts } from "../src/lib/suppliers/ipon/trackingApi";
import { getIponProductDetailUrl } from "../src/lib/suppliers/ipon/transformProduct";

function row(partial: Partial<IponMappedCategory> & Pick<IponMappedCategory, "id" | "internalCategoryId">): IponMappedCategory {
  return {
    groupKey: "98",
    listingUrl: "https://iponcomp.com/shop/group/cpu/98",
    feedCategoryPath: "Számítógép alkatrészek > Processzor",
    filtered: false,
    productGroups: ["Processors"],
    listReady: false,
    productGroupLearnedAt: "2026-11-09T12:00:00.000Z",
    membershipStatus: null,
    membershipSyncedAt: null,
    ...partial
  };
}

function classify(overrides: Partial<Parameters<typeof classifyFeedProduct>[0]> = {}) {
  return classifyFeedProduct({
    productGroup: "Processors",
    membershipCategoryIds: [],
    rows: [],
    ...overrides
  });
}

const plain = row({
  id: "cat-plain",
  internalCategoryId: "internal-cpu",
  productGroups: ["Processors", "CPU"],
  listReady: true
});
const wheel = row({
  id: "cat-wheel",
  internalCategoryId: "internal-wheel",
  filtered: true,
  listReady: true,
  productGroups: ["Controller"],
  listingUrl: "https://iponcomp.com/shop/group/console/40?12=1",
  membershipStatus: "complete"
});
const stick = row({
  id: "cat-stick",
  internalCategoryId: "internal-stick",
  filtered: true,
  listReady: true,
  productGroups: ["Controller"],
  listingUrl: "https://iponcomp.com/shop/group/console/40?12=2",
  membershipStatus: "complete"
});
const remainder = row({
  id: "cat-rest",
  internalCategoryId: "internal-rest",
  filtered: false,
  listReady: true,
  productGroups: ["Controller"],
  listingUrl: "https://iponcomp.com/shop/group/console/40"
});
const otherPlain = row({
  id: "cat-other",
  internalCategoryId: "internal-other",
  listReady: true,
  productGroups: ["Processors"],
  listingUrl: "https://iponcomp.com/shop/group/cpu-other/99"
});

const onePlain = classify({ rows: [plain] });
assert.equal(onePlain.kind, "assign");
if (onePlain.kind === "assign") assert.equal(onePlain.internalCategoryId, "internal-cpu");

const secondName = classify({ productGroup: "CPU", rows: [plain] });
assert.equal(secondName.kind, "assign");
if (secondName.kind === "assign") assert.equal(secondName.internalCategoryId, "internal-cpu");

const unknown = classify({ productGroup: "Gateway", rows: [plain] });
assert.equal(unknown.kind, "defer");
if (unknown.kind === "defer") assert.equal(unknown.reason, "unknown_group");

const filterHit = classify({
  productGroup: "Controller",
  rows: [wheel],
  membershipCategoryIds: ["cat-wheel"]
});
assert.equal(filterHit.kind, "assign");
if (filterHit.kind === "assign") assert.equal(filterHit.internalCategoryId, "internal-wheel");

const filterMiss = classify({ productGroup: "Controller", rows: [wheel] });
assert.equal(filterMiss.kind, "defer");
if (filterMiss.kind === "defer") {
  assert.equal(filterMiss.reason, "not_on_list");
  assert.equal(filterMiss.status, "unclassified");
}

const filterInterrupted = classify({
  productGroup: "Controller",
  rows: [row({ ...wheel, listReady: false })],
  membershipCategoryIds: ["cat-wheel"]
});
assert.equal(filterInterrupted.kind, "defer");
if (filterInterrupted.kind === "defer") assert.equal(filterInterrupted.reason, "awaiting_list");

const oneOfTwo = classify({
  productGroup: "Controller",
  rows: [wheel, stick],
  membershipCategoryIds: ["cat-stick"]
});
assert.equal(oneOfTwo.kind, "assign");
if (oneOfTwo.kind === "assign") assert.equal(oneOfTwo.internalCategoryId, "internal-stick");

const bothLinks = classify({
  productGroup: "Controller",
  rows: [wheel, stick],
  membershipCategoryIds: ["cat-wheel", "cat-stick"]
});
assert.equal(bothLinks.kind, "defer");
if (bothLinks.kind === "defer") {
  assert.equal(bothLinks.reason, "ambiguous");
  assert.equal(bothLinks.status, "ambiguous");
}

const interruptedPair = classify({
  productGroup: "Controller",
  rows: [wheel, row({ ...stick, listReady: false })],
  membershipCategoryIds: ["cat-wheel"]
});
assert.equal(interruptedPair.kind, "defer");
if (interruptedPair.kind === "defer") assert.equal(interruptedPair.reason, "awaiting_list");

const remainderHit = classify({ productGroup: "Controller", rows: [wheel, stick, remainder] });
assert.equal(remainderHit.kind, "assign");
if (remainderHit.kind === "assign") assert.equal(remainderHit.internalCategoryId, "internal-rest");

const filtersOnlyMiss = classify({ productGroup: "Controller", rows: [wheel, stick] });
assert.equal(filtersOnlyMiss.kind, "defer");
if (filtersOnlyMiss.kind === "defer") assert.equal(filtersOnlyMiss.reason, "not_on_list");

const plainOnOneUrl = classify({
  rows: [plain, otherPlain],
  membershipCategoryIds: ["cat-plain"]
});
assert.equal(plainOnOneUrl.kind, "assign");
if (plainOnOneUrl.kind === "assign") assert.equal(plainOnOneUrl.internalCategoryId, "internal-cpu");

const plainOnNeither = classify({ rows: [plain, otherPlain] });
assert.equal(plainOnNeither.kind, "defer");
if (plainOnNeither.kind === "defer") assert.equal(plainOnNeither.reason, "not_on_list");

const sourceUrl =
  "https://ipon.hu/shop/termek/epson-dfx-9000/11003?utm_source=arukereso&utm_medium=referral&utm_campaign=arukereso&utm_content=11003";
assert.equal(
  toIponEnglishProductUrl(sourceUrl),
  "https://iponcomp.com/shop/product/epson-dfx-9000/11003"
);
assert.equal(toIponEnglishProductUrl("https://iponcomp.com/shop/product/already/1?utm_source=x"), "https://iponcomp.com/shop/product/already/1");
assert.equal(toIponEnglishProductUrl("not a url"), null);

const xml = `<?xml version="1.0"?><products>
<product>
<name><![CDATA[EPSON DFX-9000]]></name>
<image_url><![CDATA[https://media.icdn.hu/product/x.webp]]></image_url>
<price>2560690</price>
<ean><![CDATA[]]></ean>
<identifier>11003</identifier>
<product_number><![CDATA[C11C605011BZ]]></product_number>
<manufacturer><![CDATA[EPSON]]></manufacturer>
<product_url><![CDATA[${sourceUrl}]]></product_url>
<category><![CDATA[PC, laptop > Nyomtatók]]></category>
</product>
<product><name>no id</name><price>10</price></product>
</products>`;

assert.equal(findProductOpen("<products><product>", 0), "<products>".length);
async function main() {
  const products = await parseIponProductFeedFromString(xml);
assert.equal(products.length, 1);
assert.equal(products[0]?.identifier, "11003");
assert.equal(products[0]?.ean, null);
assert.equal(products[0]?.productNumber, "C11C605011BZ");
assert.equal(products[0]?.price, 2560690);
assert.equal(parseProductBlock("<product><price>1</price></product>"), null);

const tracked = parseIponTrackingProducts({
  items: [
    {
      id: 11003,
      displayName: "EPSON DFX-9000",
      grossPrice: 2560690,
      brand: "EPSON",
      productGroup: "Printers",
      searchProductGroup: "Nyomtató",
      breadcrumb: ["PC peripherals, gaming", "Printers"],
      plusDays: 0
    }
  ]
});
assert.equal(tracked.length, 1);
assert.equal(tracked[0]?.productGroup, "Printers");
assert.equal(tracked[0]?.plusDays, 0);

const listPage = parseIponListProductsPage({
  items: [{ id: 2135812 }, { id: "1869154" }, { id: "nope" }],
  page: 1,
  pageSize: 36,
  total: 273
});
assert.deepEqual(listPage.ids, ["2135812", "1869154"]);
assert.equal(listPage.total, 273);
assert.equal(listPage.pageSize, 36);

const html = `
  <img src="https://media.icdn.hu/product/a.webp?w=100">
  <img src="https://media.icdn.hu/product/a.webp?w=800">
  <img src="https://media.icdn.hu/product/b.webp">
  <img src="https://other.example/c.jpg">
`;
const gallery = galleryUrlsExcludingMain(extractIcdnImageUrls(html), "https://media.icdn.hu/product/a.webp");
assert.deepEqual(gallery, ["https://media.icdn.hu/product/b.webp"]);

const listRow = {
  id: 2097588,
  name: "BE QUIET! CPH-6610 12VHPWR adapter cable",
  price: 7590,
  imageUrl: "https://media.icdn.hu/product/x.webp",
  webUrl: "/shop/product/be-quiet-cph-6610-12vhpwr-adapter-cable/2097588",
  isBuyable: true,
  description: "12VHPWR adapter"
};
const trackingRow = {
  id: "2097588",
  displayName: "BE QUIET! CPH-6610 12VHPWR adapter cable",
  grossPrice: 8000,
  brand: "BE QUIET!",
  productGroup: "Accessory",
  searchProductGroup: "Tartozék",
  breadcrumb: ["PC accessories, software", "Accessory"],
  plusDays: 8
};

const priced = mergeManualListProduct(listRow, trackingRow);
assert.equal(priced.ok, true);
if (priced.ok) {
  assert.equal(priced.item.grossPrice, 7590);
  assert.equal(priced.item.displayName, trackingRow.displayName);
  assert.equal(priced.item.brand, "BE QUIET!");
  assert.equal(priced.item.deliveryDays, 8);
  assert.deepEqual(priced.item.pictures, ["https://media.icdn.hu/product/x.webp"]);
  assert.equal(
    priced.item.url,
    "https://iponcomp.com/shop/product/be-quiet-cph-6610-12vhpwr-adapter-cable/2097588"
  );
  assert.equal(
    getIponProductDetailUrl(priced.item),
    "https://iponcomp.com/shop/product/be-quiet-cph-6610-12vhpwr-adapter-cable/2097588"
  );
  assert.equal(priced.active, true);
}

const fromTrackingPrice = mergeManualListProduct({ ...listRow, price: null }, trackingRow);
assert.equal(fromTrackingPrice.ok, true);
if (fromTrackingPrice.ok) assert.equal(fromTrackingPrice.item.grossPrice, 8000);

const listOnly = mergeManualListProduct({ ...listRow, isBuyable: false }, null);
assert.equal(listOnly.ok, true);
if (listOnly.ok) {
  assert.equal(listOnly.item.displayName, listRow.name);
  assert.equal(listOnly.item.grossPrice, 7590);
  assert.equal(listOnly.item.deliveryDays, undefined);
  assert.equal(listOnly.item.brand, undefined);
  assert.equal(listOnly.active, false);
  assert.equal(listOnly.item.isBuyable, false);
  const raw = mergeManualRawJson(
    { mpn: "CPH-6610", pictures_ingested_from: "https://old.example/a.webp", brand: "KEEP" },
    listOnly.item
  );
  assert.equal(raw.mpn, "CPH-6610");
  assert.equal(raw.pictures_ingested_from, "https://old.example/a.webp");
  assert.equal(raw.brand, "KEEP");
  assert.deepEqual(raw.pictures, ["https://media.icdn.hu/product/x.webp"]);
  assert.equal(raw.url, "https://iponcomp.com/shop/product/be-quiet-cph-6610-12vhpwr-adapter-cable/2097588");
}

assert.equal(parseIponManualListPage([{ id: 1 }]), null);
assert.equal(parseIponManualListPage({ products: [] }), null);
assert.equal(parseIponManualListPage({ items: [], total: 0 })?.itemCount, 0);

assert.equal(
  isManualListImportComplete({ errored: false, timedOut: false, total: 10, fetchedCount: 10, lastPageShort: false }),
  true
);
assert.equal(
  isManualListImportComplete({ errored: false, timedOut: false, total: 0, fetchedCount: 0, lastPageShort: true }),
  true
);
assert.equal(
  isManualListImportComplete({ errored: false, timedOut: false, total: 10, fetchedCount: 9, lastPageShort: true }),
  false
);
assert.equal(
  isManualListImportComplete({ errored: true, timedOut: false, total: 10, fetchedCount: 10, lastPageShort: true }),
  false
);
assert.equal(
  isManualListImportComplete({ errored: false, timedOut: true, total: 10, fetchedCount: 10, lastPageShort: true }),
  false
);
assert.equal(
  isManualListImportComplete({ errored: false, timedOut: false, total: null, fetchedCount: 0, lastPageShort: true }),
  false
);
assert.equal(
  isManualListImportComplete({ errored: false, timedOut: false, total: null, fetchedCount: 4, lastPageShort: true }),
  true
);

  console.log("test-ipon-classify: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
