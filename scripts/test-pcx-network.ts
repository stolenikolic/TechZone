/**
 * Live network smoke test for PCX anti-WAF strategy.
 * Hits homepage (warmup) → listing page 1 → first N PDPs. Reports CAPTCHA / HTTP errors.
 *
 * Run: npx tsx scripts/test-pcx-network.ts
 *   PCX_TEST_PDPS=25 npx tsx scripts/test-pcx-network.ts
 *   PCX_TEST_URL=https://www.pcx.hu/... npx tsx scripts/test-pcx-network.ts
 */
import { performance } from "node:perf_hooks";
import { parseCategoryListingHtml } from "../src/lib/suppliers/pcx/importProducts";

const BASE_ORIGIN = "https://www.pcx.hu";
const LISTING_URL = process.env.PCX_TEST_LISTING_URL ?? `${BASE_ORIGIN}/alaplap`;
const TEST_PDPS = Number(process.env.PCX_TEST_PDPS ?? 20);
const EXTRA_URL = process.env.PCX_TEST_URL;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const cookieJar = new Map<string, string>();

function cookieHeader() {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function ingestSetCookies(res: Response) {
  type R = Response & { headers: Headers & { getSetCookie?: () => string[] } };
  const raw = typeof (res as R).headers.getSetCookie === "function" ? (res as R).headers.getSetCookie!() : [];
  for (const c of raw) {
    const semi = c.indexOf(";");
    const pair = semi >= 0 ? c.slice(0, semi) : c;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function headers(kind: "homepage" | "listing" | "pdp", referer: string | null): HeadersInit {
  const h: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    Connection: "keep-alive",
    "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": kind === "homepage" || !referer ? "none" : "same-origin",
    "sec-fetch-user": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
  if (referer) h.Referer = referer;
  const c = cookieHeader();
  if (c) h.Cookie = c;
  return h;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1500 + Math.floor(Math.random() * 1501);

function isCaptchaLike(html: string) {
  const l = html.toLowerCase();
  return l.includes("captcha") || l.includes("verify");
}

async function get(url: string, kind: "homepage" | "listing" | "pdp", referer: string | null) {
  const t = performance.now();
  const res = await fetch(url, { headers: headers(kind, referer) });
  ingestSetCookies(res);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const ms = Math.round(performance.now() - t);
  return { html, ms };
}

async function main() {
  console.log(`[smoke] listing=${LISTING_URL} target PDPs=${TEST_PDPS}`);

  console.log("[smoke] warmup: homepage");
  const home = await get(`${BASE_ORIGIN}/`, "homepage", null);
  if (isCaptchaLike(home.html)) throw new Error("CAPTCHA on homepage");
  console.log(`[smoke] homepage OK (${home.ms}ms), cookies=${cookieJar.size}`);

  const queue: { url: string; refererListing: string }[] = [];
  let page = 1;
  let prevListingUrl = `${BASE_ORIGIN}/`;

  while (queue.length < TEST_PDPS && page <= 5) {
    const listUrl =
      page === 1 ? LISTING_URL : `${LISTING_URL}${LISTING_URL.includes("?") ? "&" : "?"}oldal=${page}`;
    await delay(jitter());
    console.log(`[smoke] listing page ${page}: ${listUrl}`);
    const listing = await get(listUrl, "listing", prevListingUrl);
    if (isCaptchaLike(listing.html)) throw new Error(`CAPTCHA on listing page ${page}`);

    const items = parseCategoryListingHtml(listing.html);
    const before = queue.length;
    for (const item of items) {
      if (queue.length >= TEST_PDPS) break;
      if (!queue.some((q) => q.url === item.supplierProductUrl)) {
        queue.push({ url: item.supplierProductUrl, refererListing: listUrl });
      }
    }
    console.log(
      `[smoke] listing page ${page} OK (${listing.ms}ms, parsed=${items.length}, queue=${queue.length}, +${queue.length - before})`
    );
    if (items.length === 0) break;
    prevListingUrl = listUrl;
    page += 1;
  }

  if (EXTRA_URL) {
    queue.unshift({
      url: EXTRA_URL,
      refererListing: LISTING_URL
    });
    console.log(`[smoke] prepended PCX_TEST_URL: ${EXTRA_URL}`);
  }

  if (queue.length === 0) throw new Error("No PDP URLs parsed from listing");

  let ok = 0;
  let captcha = 0;
  let errors = 0;

  for (let i = 0; i < queue.length; i++) {
    await delay(jitter());
    const { url, refererListing } = queue[i];
    try {
      const r = await get(url, "pdp", refererListing);
      if (isCaptchaLike(r.html)) {
        captcha += 1;
        console.warn(`[smoke] PDP ${i + 1}/${queue.length} CAPTCHA-like: ${url}`);
      } else {
        ok += 1;
        const hasProduct = r.html.includes('"@type":"Product"') || r.html.includes('"@type": "Product"');
        console.log(
          `[smoke] PDP ${i + 1}/${queue.length} OK (${r.ms}ms, jsonLd=${hasProduct}) ${url}`
        );
      }
    } catch (e) {
      errors += 1;
      console.error(`[smoke] PDP ${i + 1}/${queue.length} error: ${(e as Error).message}`);
    }
  }

  console.log(`\n[smoke] DONE: ok=${ok} captcha=${captcha} errors=${errors} cookies=${cookieJar.size}`);
  if (captcha > 0 || errors > 0) process.exit(2);
}

main().catch((e) => {
  console.error("[smoke] FAIL:", e);
  process.exit(1);
});
