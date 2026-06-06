const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "hu-HU,hu;q=0.9" },
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const pdp = await fetchHtml(
    "https://www.konzolvilag.hu/pc/amd-ryzen-7-8700g-am5-box-100-100001236box"
  );
  const list = await fetchHtml("https://www.konzolvilag.hu/pc/hardver/processzor");

  for (const [name, html] of [
    ["pdp", pdp],
    ["list", list]
  ] as const) {
    console.log(`--- ${name} len=${html.length}`);
    for (const m of [
      "application/ld+json",
      "schema.org",
      "itemprop",
      "Gyártói cikkszám",
      "Termékazonosító",
      "Bruttó",
      "Készleten",
      "Rendelésre",
      "További termékek",
      "page=",
      "data-page",
      "/pc/"
    ]) {
      console.log(`  ${m}: ${html.includes(m)}`);
    }
    const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
    console.log(`  ld_scripts: ${ld?.length ?? 0}`);
    if (ld?.length) console.log(ld[0].slice(0, 400));

    const itemprops = [...html.matchAll(/itemprop=["']([^"']+)["']/g)].map((m) => m[1]);
    if (itemprops.length) console.log(`  itemprops: ${[...new Set(itemprops)].join(", ")}`);
  }

  const gyarto = pdp.match(/Gyártói[\s\S]{0,400}/i)?.[0];
  console.log("gyarto snippet:", gyarto?.slice(0, 250));
  const gar = pdp.match(/Garancia[\s\S]{0,250}/i)?.[0];
  console.log("gar snippet:", gar?.slice(0, 200));
  const more = list.match(/További termékek[\s\S]{0,250}/i)?.[0];
  console.log("load more:", more?.slice(0, 200));
  const pages = [...list.matchAll(/page=\d+/g)].map((m) => m[0]);
  console.log("page params:", [...new Set(pages)]);

  const priceProp = pdp.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
  console.log("itemprop price:", priceProp?.[1]);
  const avail = pdp.match(/itemprop=["']availability["'][^>]*(?:content=["']([^"']+)["']|href=["']([^"']+)["'])/i);
  console.log("itemprop availability:", avail?.[1] ?? avail?.[2]);
  const guarantee = pdp.match(
    /data-remodal-id="guarantee-info-popup"[\s\S]{0,2500}/i
  )?.[0];
  console.log("guarantee popup:", guarantee?.slice(0, 800));
  const loadHref = list.match(/További termékek[\s\S]{0,80}href=["']([^"']+)["']/i);
  console.log("load more href:", loadHref?.[1]);
  const ean = pdp.match(/EAN|Vonalkód|gtin/i);
  console.log("ean markers:", ean?.[0] ?? "none");

  const hónap = pdp.match(/\d+\s*hónap/gi);
  console.log("hónap in pdp:", hónap?.slice(0, 5));
  const loadBlock = list.match(/class="[^"]*load[^"]*"[\s\S]{0,300}/gi);
  console.log("load blocks:", loadBlock?.slice(0, 2)?.map((s) => s.slice(0, 150)));
  const ajax = [...list.matchAll(/(?:load|more|page|offset|subpage)[^"'\s]{0,30}(?:\.php|\.json|\/api)/gi)].map(
    (m) => m[0]
  );
  console.log("ajax hints:", [...new Set(ajax)].slice(0, 10));
  const moreAnchor = list.match(/<a[^>]+>[\s\S]{0,40}További termékek[\s\S]{0,200}/i)?.[0];
  console.log("more anchor:", moreAnchor?.slice(0, 250));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
