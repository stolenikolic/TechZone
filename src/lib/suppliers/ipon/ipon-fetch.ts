/**
 * Zajednički iPon HTTP: cookie jar, warmup, isti UA/jezik za import i scrape (manje captcha).
 */

import { fetchWithSession, type FetchWithSessionOptions } from "lib/suppliers/shared/http-session";

import { withTransientHttpRetry } from "./transient-retry";

export const IPON_IMPORT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export const IPON_ACCEPT_LANGUAGE = "en-HU,en;q=0.9,hu;q=0.8";

export function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Discovery mode: cijene ide preko XML sync-a; API samo novi artikli + slika. */
export function isIponDiscoveryImportMode(): boolean {
  const mode = process.env.IPON_IMPORT_MODE?.trim().toLowerCase();
  return mode !== "full" && mode !== "legacy";
}

const discoveryImport = isIponDiscoveryImportMode();

/** Pauza između koraka warmup-a i između stranica liste (ms). */
export const IPON_WARMUP_GAP_MS = numEnv("IPON_WARMUP_GAP_MS", discoveryImport ? 300 : 900);
export const IPON_PAGE_DELAY_MS = numEnv("IPON_PAGE_DELAY_MS", discoveryImport ? 0 : 650);
export const IPON_BEFORE_LIST_API_MS = numEnv("IPON_BEFORE_LIST_API_MS", discoveryImport ? 0 : 500);

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseGroupIdFromListingUrl(categoryUrl: string): number {
  const u = new URL(categoryUrl);
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i]!)) return Number(parts[i]);
  }
  throw new Error(`Ne mogu izvući iPon group id iz URL-a: ${categoryUrl}`);
}

export function getIponOrigin(listingUrl: string): string {
  return new URL(listingUrl).origin;
}

/**
 * Jedna cookie sesija za sve zahteve u toku importa / scrape-a.
 */
export function createIponCookieJar(): Map<string, string> {
  return new Map<string, string>();
}

const IPON_HTTP_RETRY_BACKOFF_MS = [2000, 5000, 10000] as const;
const IPON_TRANSIENT_HTTP_STATUSES = new Set([429, 502, 503, 504]);

async function fetchIponWithRetry(
  label: string,
  url: string,
  sessionOpts: FetchWithSessionOptions,
  options?: { listingUrl?: string; jar?: Map<string, string> }
): Promise<Response> {
  const maxAttempts = 1 + IPON_HTTP_RETRY_BACKOFF_MS.length;

  return withTransientHttpRetry(
    label,
    () => fetchWithSession(url, sessionOpts),
    {
      backoffMs: IPON_HTTP_RETRY_BACKOFF_MS,
      isRetryableResponse: (res) => IPON_TRANSIENT_HTTP_STATUSES.has(res.status),
      onBeforeRetry: async (attempt) => {
        if (options?.listingUrl && options.jar && attempt === maxAttempts - 1) {
          console.warn(`[iPon][retry] re-warmup sesije prije zadnjeg pokušaja: ${label}`);
          await warmupIponSessionForListing(options.jar, options.listingUrl, IPON_WARMUP_GAP_MS);
        }
      }
    }
  );
}

/**
 * Warmup: početna → pauza → listing stranica → pauza (pre prvog product/data).
 * Koristi se i za import liste i kao referer sesija za scrape detalja.
 */
export async function warmupIponSessionForListing(
  jar: Map<string, string>,
  listingUrl: string,
  gapMs: number = IPON_WARMUP_GAP_MS
): Promise<void> {
  const origin = getIponOrigin(listingUrl);

  const homeRes = await fetchIponWithRetry(`warmup home ${origin}`, `${origin}/`, {
    jar,
    userAgent: IPON_IMPORT_USER_AGENT,
    referer: `${origin}/`,
    acceptJson: false,
    acceptLanguage: IPON_ACCEPT_LANGUAGE,
    origin
  });
  if (homeRes.ok) await homeRes.text();
  await sleep(gapMs);

  const catRes = await fetchIponWithRetry(`warmup listing ${listingUrl}`, listingUrl, {
    jar,
    userAgent: IPON_IMPORT_USER_AGENT,
    referer: `${origin}/`,
    acceptJson: false,
    acceptLanguage: IPON_ACCEPT_LANGUAGE,
    origin
  });
  if (!catRes.ok) {
    throw new Error(`iPon kategorija HTTP ${catRes.status}: ${listingUrl}`);
  }
  await catRes.text();
  await sleep(gapMs);
}

export function productDataUrl(origin: string, groupId: number, page: number): string {
  return `${origin}/shop/group/${groupId}/product/data?page=${page}`;
}

export async function fetchIponProductDataPage(
  jar: Map<string, string>,
  listingUrl: string,
  groupId: number,
  page: number
): Promise<Response> {
  const origin = getIponOrigin(listingUrl);
  const url = productDataUrl(origin, groupId, page);
  return fetchIponWithRetry(
    `product/data page=${page} group=${groupId}`,
    url,
    {
      jar,
      userAgent: IPON_IMPORT_USER_AGENT,
      referer: listingUrl,
      acceptJson: true,
      acceptLanguage: IPON_ACCEPT_LANGUAGE,
      origin
    },
    { jar, listingUrl }
  );
}

export function looksLikeCaptchaOrBlock(text: string, status: number): boolean {
  if (status === 429) return true;
  const s = text.slice(0, 500).toLowerCase();
  return (
    s.includes("captcha") ||
    s.includes("cf-browser-verification") ||
    s.includes("attention required") ||
    s.includes("access denied")
  );
}
