/**
 * One-off: fetch Konzolvilág listing + PDP HTML into OS tmp for parser discovery.
 * Run: npx tsx scripts/tmp-konzolvilag-fetch-html.ts
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
  const listUrl = "https://www.konzolvilag.hu/pc/hardver/processzor";
  const list2Url = "https://www.konzolvilag.hu/pc/hardver/processzor/oldal-2";
  const pdpUrl =
    "https://www.konzolvilag.hu/pc/amd-ryzen-7-8700g-am5-box-100-100001236box";

  await fetchHtml("https://www.konzolvilag.hu/");
  const list = await fetchHtml(listUrl, "https://www.konzolvilag.hu/");
  const list2 = await fetchHtml(list2Url, listUrl);
  const pdp = await fetchHtml(pdpUrl, listUrl);

  const dir = tmpdir();
  writeFileSync(join(dir, "kv-list-p1.html"), list);
  writeFileSync(join(dir, "kv-list-p2.html"), list2);
  writeFileSync(join(dir, "kv-pdp.html"), pdp);

  console.log("saved", {
    listPath: join(dir, "kv-list-p1.html"),
    list2Path: join(dir, "kv-list-p2.html"),
    pdpPath: join(dir, "kv-pdp.html"),
    listLen: list.length,
    list2Len: list2.length,
    pdpLen: pdp.length
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
