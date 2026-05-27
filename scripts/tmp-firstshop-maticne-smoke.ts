/**
 * TEMP — smoke test: FirstShop matične (alaplap), ista detekcija kao importer.
 * Briši kad završiš debug.
 *
 * Run:
 *   npx tsx scripts/tmp-firstshop-maticne-smoke.ts
 *   FIRSTSHOP_LISTING_URL=https://firstshop.hu/hardver/alaplap-c1 npx tsx scripts/tmp-firstshop-maticne-smoke.ts
 *   FIRSTSHOP_TEST_PDPS=10 npx tsx scripts/tmp-firstshop-maticne-smoke.ts
 */
import { performance } from "node:perf_hooks";
import {
  hasLikelyProductDetailHtml,
  isBotChallengeHtml,
  isSupplierListingBlocked
} from "../src/lib/suppliers/shared/bot-challenge";
import { parseCategoryListingHtml } from "../src/lib/suppliers/firstshop/importProducts";

const BASE_ORIGIN = "https://firstshop.hu";
const LISTING_URL =
  process.env.FIRSTSHOP_LISTING_URL?.trim() || `${BASE_ORIGIN}/hardver/alaplap-c1`;
const TEST_PDPS = Number(process.env.FIRSTSHOP_TEST_PDPS ?? 15);

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
  const raw =
    typeof (res as R).headers.getSetCookie === "function" ? (res as R).headers.getSetCookie!() : [];
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

function challengeContext(html: string): string | null {
  if (!isBotChallengeHtml(html)) return null;
  const l = html.toLowerCase();
  const markers = [
    "cf-challenge",
    "turnstile",
    "g-recaptcha",
    "just a moment",
    "verify you are human"
  ];
  for (const m of markers) {
    const i = l.indexOf(m);
    if (i >= 0) return html.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, " ");
  }
  return "(challenge marker found)";
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1500 + Math.floor(Math.random() * 1501);

async function get(url: string, kind: "homepage" | "listing" | "pdp", referer: string | null) {
  const t = performance.now();
  const res = await fetch(url, { headers: headers(kind, referer) });
  ingestSetCookies(res);
  const html = await res.text();
  const ms = Math.round(performance.now() - t);
  return { status: res.status, html, ms };
}

async function main() {
  console.log(`[maticne-smoke] listing=${LISTING_URL} PDPs=${TEST_PDPS}`);

  const home = await get(`${BASE_ORIGIN}/`, "homepage", null);
  console.log(`[maticne-smoke] homepage HTTP ${home.status} (${home.ms}ms) cookies=${cookieJar.size}`);
  if (isBotChallengeHtml(home.html)) {
    console.error("[maticne-smoke] FAIL: importer bi stao na warmup (bot challenge)");
    console.error("  context:", challengeContext(home.html));
    process.exit(1);
  }

  await delay(jitter());
  const listing = await get(LISTING_URL, "listing", `${BASE_ORIGIN}/`);
  console.log(
    `[maticne-smoke] listing p1 HTTP ${listing.status} (${listing.ms}ms) len=${listing.html.length}`
  );

  const items = parseCategoryListingHtml(listing.html);
  if (isSupplierListingBlocked(listing.html, items.length)) {
    console.error("[maticne-smoke] FAIL: importer bi stao na category listing (page 1)");
    console.error("  context:", challengeContext(listing.html));
    process.exit(1);
  }
  console.log(`[maticne-smoke] listing p1 parsed cards=${items.length} (importer parser)`);
  if (items.length === 0) {
    console.error("[maticne-smoke] FAIL: 0 kartica — nije challenge, ali parser nema što skrejpovati");
    process.exit(1);
  }

  const queue = items.slice(0, TEST_PDPS);
  let ok = 0;
  let captcha = 0;
  let errors = 0;

  for (let i = 0; i < queue.length; i++) {
    await delay(jitter());
    const item = queue[i];
    try {
      const r = await get(item.supplierProductUrl, "pdp", LISTING_URL);
      if (isBotChallengeHtml(r.html) && !hasLikelyProductDetailHtml(r.html)) {
        captcha += 1;
        console.warn(`[maticne-smoke] PDP ${i + 1}/${queue.length} bot challenge`);
        console.warn("  context:", challengeContext(r.html));
      } else {
        ok += 1;
        console.log(`[maticne-smoke] PDP ${i + 1}/${queue.length} OK (${r.ms}ms) ${item.name.slice(0, 50)}`);
      }
    } catch (e) {
      errors += 1;
      console.error(`[maticne-smoke] PDP ${i + 1} HTTP error:`, (e as Error).message);
    }
  }

  console.log(`\n[maticne-smoke] DONE listing_ok=true ok=${ok} captcha=${captcha} errors=${errors}`);
  if (captcha > 0 || errors > 0) process.exit(2);
}

main().catch((e) => {
  console.error("[maticne-smoke] FAIL:", e);
  process.exit(1);
});
