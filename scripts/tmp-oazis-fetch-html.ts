/**
 * One-off: fetch Oázis listing + PDP HTML into OS tmp for parser discovery.
 * Run: npx tsx scripts/tmp-oazis-fetch-html.ts
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
    },
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const listUrl = "https://oaziscomputer.hu/kategoria/27/processzor/1";
  const pdpUrl =
    "https://oaziscomputer.hu/termek/30800/amd-ryzen-7-8700g-100-100001236box";

  await fetchHtml("https://oaziscomputer.hu/");
  const list = await fetchHtml(listUrl, "https://oaziscomputer.hu/");
  const pdp = await fetchHtml(pdpUrl, listUrl);

  const dir = tmpdir();
  const listPath = join(dir, "oazis-list-p1.html");
  const pdpPath = join(dir, "oazis-pdp.html");
  writeFileSync(listPath, list);
  writeFileSync(pdpPath, pdp);

  console.log("saved", { listPath, pdpPath, listLen: list.length, pdpLen: pdp.length });

  for (const [name, html] of [
    ["list", list],
    ["pdp", pdp]
  ] as const) {
    console.log(`--- ${name}`);
    for (const m of [
      "/termek/",
      "Termékkód",
      "munkanap",
      "hónap",
      "/processzor/2",
      "Specifikációk",
      "Ft"
    ]) {
      console.log(`  ${m}: ${html.includes(m)}`);
    }
  }

  const termek = pdp.match(/Termékkód[\s\S]{0,120}/i)?.[0];
  console.log("termekkod snippet:", termek?.slice(0, 200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
