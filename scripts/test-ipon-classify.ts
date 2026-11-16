/**
 * Classification, feed URL and gallery parser tests.
 * Run: npx tsx scripts/test-ipon-classify.ts
 */
import assert from "node:assert/strict";
import { classifyFeedProduct, type IponMappedCategory } from "../src/lib/suppliers/ipon/classifyFeedProduct";
import { extractIcdnImageUrls, galleryUrlsExcludingMain } from "../src/lib/suppliers/ipon/icdnImages";
import { parseIponListProductsPage } from "../src/lib/suppliers/ipon/listMembership";
import { buildIponMenuIndex, listIdForCategoryPath, menuOwnMatchesFilterRule, resolveIponMenuUrl } from "../src/lib/suppliers/ipon/iponMenu";
import {
  findProductOpen,
  manualFeedPathFromInput,
  parseIponProductFeedFromString,
  parseProductBlock,
  toIponEnglishProductUrl,
  twoLevelFeedKey
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
    categoryName: null,
    groupKey: "98",
    listingUrl: "https://iponcomp.com/shop/group/cpu/98",
    feedCategoryPath: null,
    manualFeedPath: null,
    filtered: false,
    productGroups: [],
    listReady: false,
    productGroupLearnedAt: null,
    membershipStatus: null,
    membershipSyncedAt: null,
    ...partial
  };
}

const PSU_PATH = "Számítógép alkatrész > Tápegység > 550W > ATX";
const SERVER_PSU_PATH = "Hálózat, szerver, biztonságtechnika > Szerver további alkatrész > Tápegység";
const WHEEL_PATH = "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Kormány, pedál, váltó, ülés";

function classify(overrides: Partial<Parameters<typeof classifyFeedProduct>[0]> = {}) {
  return classifyFeedProduct({
    categoryPath: PSU_PATH,
    menuListId: "343",
    membershipCategoryIds: [],
    rows: [],
    ...overrides
  });
}

assert.equal(twoLevelFeedKey(PSU_PATH), "Számítógép alkatrész > Tápegység");
assert.equal(twoLevelFeedKey(SERVER_PSU_PATH), "Hálózat, szerver, biztonságtechnika > Szerver további alkatrész");
assert.equal(twoLevelFeedKey("Csak jedan"), null);
assert.equal(twoLevelFeedKey(PSU_PATH), twoLevelFeedKey("Számítógép alkatrész > Tápegység"));
const saved = manualFeedPathFromInput("  A  >  B  >  C  ");
assert.ok(!("error" in saved) && saved.path === "A > B > C");
assert.ok("error" in manualFeedPathFromInput("Samo jedan"));
assert.ok(!("error" in manualFeedPathFromInput("  ")) && manualFeedPathFromInput("  ").path === null);

const psu = row({
  id: "cat-psu",
  internalCategoryId: "internal-psu",
  categoryName: "Napajanja",
  groupKey: "343",
  listReady: true
});
const server = row({
  id: "cat-server",
  internalCategoryId: "internal-server",
  categoryName: "Serveri",
  groupKey: "1155",
  listReady: true
});
const wheel = row({
  id: "cat-wheel",
  internalCategoryId: "internal-wheel",
  filtered: true,
  listReady: true,
  groupKey: "938",
  listingUrl: "https://iponcomp.com/shop/group/console/938?730=1",
  membershipStatus: "complete",
  manualFeedPath: WHEEL_PATH
});
const stick = row({
  id: "cat-stick",
  internalCategoryId: "internal-stick",
  filtered: true,
  listReady: true,
  groupKey: "938",
  listingUrl: "https://iponcomp.com/shop/group/console/938?730=2",
  membershipStatus: "complete"
});
const remainder = row({
  id: "cat-rest",
  internalCategoryId: "internal-rest",
  filtered: false,
  listReady: true,
  groupKey: "938",
  listingUrl: "https://iponcomp.com/shop/group/console/938"
});
const otherPlain = row({
  id: "cat-other",
  internalCategoryId: "internal-other",
  listReady: true,
  groupKey: "343",
  listingUrl: "https://iponcomp.com/shop/group/psu-other/343"
});

const onePlain = classify({ rows: [psu] });
assert.equal(onePlain.kind, "assign");
if (onePlain.kind === "assign") assert.equal(onePlain.internalCategoryId, "internal-psu");

const deeperBreadcrumb = classify({
  categoryPath: "Számítógép alkatrész > Tápegység > 750W > SFX",
  rows: [psu]
});
assert.equal(deeperBreadcrumb.kind, "assign");

const serverPsu = classify({
  categoryPath: SERVER_PSU_PATH,
  menuListId: "1155",
  rows: [psu, server]
});
assert.equal(serverPsu.kind, "assign");
if (serverPsu.kind === "assign") assert.equal(serverPsu.internalCategoryId, "internal-server");

const installation = classify({
  categoryPath: "Otthon, kert, barkács > Szerelési anyagok > Okvir",
  menuListId: "1637",
  rows: [psu]
});
assert.equal(installation.kind, "defer");
if (installation.kind === "defer") assert.equal(installation.reason, "unknown_path");

const oneLevel = classify({ categoryPath: "Számítógép alkatrész", menuListId: null, rows: [psu] });
assert.equal(oneLevel.kind, "defer");
if (oneLevel.kind === "defer") assert.equal(oneLevel.reason, "unknown_path");

const manualWins = classify({
  categoryPath: `${WHEEL_PATH} > 900 fok`,
  menuListId: "938",
  rows: [remainder, wheel]
});
assert.equal(manualWins.kind, "assign");
if (manualWins.kind === "assign") assert.equal(manualWins.internalCategoryId, "internal-wheel");

const sameManual = classify({
  categoryPath: WHEEL_PATH,
  menuListId: "938",
  rows: [wheel, row({ ...wheel, id: "cat-wheel-2", internalCategoryId: "internal-wheel-2" })]
});
assert.equal(sameManual.kind, "defer");
if (sameManual.kind === "defer") {
  assert.equal(sameManual.reason, "ambiguous_path");
  assert.equal(sameManual.path, WHEEL_PATH);
}

const filterHit = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [stick],
  membershipCategoryIds: ["cat-stick"]
});
assert.equal(filterHit.kind, "assign");
if (filterHit.kind === "assign") assert.equal(filterHit.internalCategoryId, "internal-stick");

const filterMiss = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [stick]
});
assert.equal(filterMiss.kind, "defer");
if (filterMiss.kind === "defer") {
  assert.equal(filterMiss.reason, "not_on_list");
  assert.equal(filterMiss.status, "unclassified");
}

const filterInterrupted = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [row({ ...stick, listReady: false })],
  membershipCategoryIds: ["cat-stick"]
});
assert.equal(filterInterrupted.kind, "defer");
if (filterInterrupted.kind === "defer") assert.equal(filterInterrupted.reason, "awaiting_list");

const oneOfTwo = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheel, stick],
  membershipCategoryIds: ["cat-stick"]
});
assert.equal(oneOfTwo.kind, "assign");
if (oneOfTwo.kind === "assign") assert.equal(oneOfTwo.internalCategoryId, "internal-stick");

const stickOnly = row({ ...stick, manualFeedPath: null });
const wheelPlainFilter = row({ ...wheel, manualFeedPath: null });
const oneFilterOfTwo = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheelPlainFilter, stickOnly],
  membershipCategoryIds: ["cat-stick"]
});
assert.equal(oneFilterOfTwo.kind, "assign");
if (oneFilterOfTwo.kind === "assign") assert.equal(oneFilterOfTwo.internalCategoryId, "internal-stick");

const bothLinks = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheelPlainFilter, stickOnly],
  membershipCategoryIds: ["cat-wheel", "cat-stick"]
});
assert.equal(bothLinks.kind, "defer");
if (bothLinks.kind === "defer") {
  assert.equal(bothLinks.reason, "ambiguous");
  assert.equal(bothLinks.status, "ambiguous");
}

const interruptedPair = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheelPlainFilter, row({ ...stickOnly, listReady: false })],
  membershipCategoryIds: ["cat-wheel"]
});
assert.equal(interruptedPair.kind, "defer");
if (interruptedPair.kind === "defer") assert.equal(interruptedPair.reason, "awaiting_list");

const remainderHit = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheelPlainFilter, stickOnly, remainder]
});
assert.equal(remainderHit.kind, "assign");
if (remainderHit.kind === "assign") assert.equal(remainderHit.internalCategoryId, "internal-rest");

const filtersOnlyMiss = classify({
  categoryPath: "Konzol, játék, gyerekjáték, iskola > Konzol tartozék > Pedál",
  menuListId: "938",
  rows: [wheelPlainFilter, stickOnly]
});
assert.equal(filtersOnlyMiss.kind, "defer");
if (filtersOnlyMiss.kind === "defer") assert.equal(filtersOnlyMiss.reason, "not_on_list");

const plainOnOneUrl = classify({
  rows: [psu, otherPlain],
  membershipCategoryIds: ["cat-psu"]
});
assert.equal(plainOnOneUrl.kind, "assign");
if (plainOnOneUrl.kind === "assign") assert.equal(plainOnOneUrl.internalCategoryId, "internal-psu");

const plainOnNeither = classify({ rows: [psu, otherPlain] });
assert.equal(plainOnNeither.kind, "defer");
if (plainOnNeither.kind === "defer") assert.equal(plainOnNeither.reason, "not_on_list");

const menuHtml = `
  <a href="/shop/csoport/szamitogep-alkatresz/78">Számítógép alkatrész</a>
  <a href="/shop/csoport/halozat-szerver-biztonsagtechnika/1035">Hálózat, szerver, biztonságtechnika</a>
  <a href="/shop/csoport/halozat-szerver-biztonsagtechnika/switch/1129">ne koristi se</a>
`;
const menuJson = {
  "78": [
    { name: "Tápegység", href: "/shop/csoport/szamitogep-alkatresz/tapegyseg/343", own: true },
    { name: "Gamer", href: "/shop/csoport/szamitogep-alkatresz/tapegyseg/343?230=1", own: true }
  ],
  "1035": [
    { name: "Switch", href: "/shop/csoport/halozat-szerver-biztonsagtechnika/switch/1129", own: true },
    { name: "Szerver további alkatrész", href: "/shop/csoport/halozat-szerver-biztonsagtechnika/szerver-tovabbi-alkatresz/1155", own: true },
    { name: "Szerver", href: "/shop/csoport/halozat-szerver-biztonsagtechnika/szerver-tovabbi-alkatresz/1155?12=3632", own: true },
    { name: "Joystick/Kormány", href: "/shop/csoport/konzol-jatek-gyerekjatek-iskola/konzol-tartozek/938?730=1", own: true }
  ]
};
const menu = buildIponMenuIndex(menuHtml, menuJson, "abc");
assert.equal(listIdForCategoryPath(menu, PSU_PATH), "343");
assert.equal(listIdForCategoryPath(menu, SERVER_PSU_PATH), "1155");
assert.equal(menu.listIdByTwoLevelKey.get("Számítógép alkatrész > Gamer"), undefined);
assert.equal(menu.listIdByTwoLevelKey.get("Hálózat, szerver, biztonságtechnika > Szerver"), undefined);
assert.equal(menu.ownMatchesFilterRule, false);
assert.equal(menuOwnMatchesFilterRule({
  "1035": [
    { href: "/shop/csoport/halozat-szerver-biztonsagtechnika/switch/1129", own: true },
    { href: "/shop/csoport/konzol-jatek-gyerekjatek-iskola/konzol-tartozek/938?730=1", own: false }
  ]
}), true);
assert.equal(
  resolveIponMenuUrl('{"siteId":"hu_HU","listsVersion":"7b00464a5949"}'),
  "https://ipon.hu/api/menu/hu_HU-7b00464a5949.json"
);
assert.equal(
  resolveIponMenuUrl('{\\"siteId\\":\\"hu_HU\\",\\"listsVersion\\":\\"7b00464a5949\\"}'),
  "https://ipon.hu/api/menu/hu_HU-7b00464a5949.json"
);
assert.equal(
  resolveIponMenuUrl("stari hu_HU-7c9bd250178a.json"),
  "https://ipon.hu/api/menu/hu_HU-7c9bd250178a.json"
);
assert.equal(resolveIponMenuUrl("<html></html>"), null);

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

const huXml = `<product>
<id>11003</id>
<name><![CDATA[EPSON DFX-9000]]></name>
<brand><![CDATA[EPSON]]></brand>
<product_number><![CDATA[C11C605011BZ]]></product_number>
<picture_url><![CDATA[https://media.icdn.hu/product/x.webp]]></picture_url>
<gross_price>2560690</gross_price>
<category><![CDATA[${PSU_PATH}]]></category>
<url><![CDATA[https://ipon.hu/shop/termek/epson-dfx-9000/11003]]></url>
<ean><![CDATA[]]></ean>
</product>`;
const hu = parseProductBlock(huXml);
assert.equal(hu?.identifier, "11003");
assert.equal(hu?.manufacturer, "EPSON");
assert.equal(hu?.imageUrl, "https://media.icdn.hu/product/x.webp");
assert.equal(hu?.price, 2560690);
assert.equal(hu?.categoryPath, PSU_PATH);
assert.equal(twoLevelFeedKey(hu?.categoryPath), "Számítógép alkatrész > Tápegység");
assert.equal(
  toIponEnglishProductUrl(hu?.productUrl),
  "https://iponcomp.com/shop/product/epson-dfx-9000/11003"
);

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
