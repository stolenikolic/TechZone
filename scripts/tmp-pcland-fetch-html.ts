/**
 * One-off: fetch PCLand listing + PDP HTML into OS tmp for parser discovery.
 * Run: npx tsx scripts/tmp-pcland-fetch-html.ts
 */
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "hu-HU,hu;q=0.9",
      ...(referer ? { Referer: referer } : {})
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const listUrl =
    "https://pcland.hu/termekek-158/szamitogep-alkatresz-160/processzor-397";
  const pdpUrl = "https://pcland.hu/amd-ryzen-5-5600x-37ghz-am4-box-48979";

  await fetchHtml("https://pcland.hu/");
  const list = await fetchHtml(listUrl, "https://pcland.hu/");
  const pdp = await fetchHtml(pdpUrl, listUrl);

  const dir = tmpdir();
  const listPath = join(dir, "pcl-list-p1.html");
  const pdpPath = join(dir, "pcl-pdp.html");
  writeFileSync(listPath, list);
  writeFileSync(pdpPath, pdp);

  console.log("saved", { listPath, pdpPath, listLen: list.length, pdpLen: pdp.length });

  for (const [name, html] of [
    ["list", list],
    ["pdp", pdp]
  ] as const) {
    console.log(`--- ${name}`);
    for (const m of [
      "product-item",
      "product_box",
      "Cikkszám",
      "Gyártó cikkszám",
      "Vonalkód",
      "Központi raktáron",
      "page=",
      "data-page",
      "termék"
    ]) {
      console.log(`  ${m}: ${html.includes(m)}`);
    }
  }

  const cik = pdp.match(/Cikkszám[\s\S]{0,250}/i)?.[0];
  console.log("cik snippet:", cik?.slice(0, 280));
  const avail = pdp.match(/Elérhetőség[\s\S]{0,800}/i)?.[0];
  console.log("avail snippet:", avail?.slice(0, 600));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
