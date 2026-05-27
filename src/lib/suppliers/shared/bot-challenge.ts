/**
 * Bot / CAPTCHA challenge detection for HTML supplier scrapers.
 * Avoids false positives from product copy (e.g. "verifying read/write bandwidth").
 */

const BOT_CHALLENGE_MARKERS = [
  "cf-challenge",
  "cf-browser-verification",
  "challenge-platform",
  "__cf_chl",
  "g-recaptcha",
  "grecaptcha",
  "hcaptcha",
  "h-captcha",
  "turnstile",
  "just a moment",
  "checking your browser",
  "attention required",
  "verify you are human",
  "verify that you are human",
  "are you a robot",
  "bot check",
  "complete the security check"
] as const;

/** True when HTML looks like a WAF / CAPTCHA challenge page (not product copy). */
export function isBotChallengeHtml(html: string): boolean {
  const l = html.toLowerCase();
  return BOT_CHALLENGE_MARKERS.some((m) => l.includes(m));
}

/** Homepage warmup — no product structure to validate. */
export function isSupplierWarmupBlocked(html: string): boolean {
  return isBotChallengeHtml(html);
}

/** Category listing — if parser found cards, treat as real page even with stray challenge strings. */
export function isSupplierListingBlocked(html: string, parsedListingCount: number): boolean {
  if (parsedListingCount > 0) return false;
  return isBotChallengeHtml(html);
}

/** Product detail — if page has product signals, not a block page. */
export function isSupplierDetailBlocked(html: string, hasProductSignals: boolean): boolean {
  if (hasProductSignals) return false;
  return isBotChallengeHtml(html);
}

/** Heuristic: normal PDP HTML (JSON-LD, price meta, Cikkszám, PCX real-price). */
export function hasLikelyProductDetailHtml(html: string): boolean {
  const l = html.toLowerCase();
  return (
    l.includes('"@type":"product"') ||
    l.includes('"@type": "product"') ||
    /<meta[^>]+itemprop="price"/i.test(html) ||
    /cikkszám/i.test(html) ||
    /itemprop="mpn"/i.test(html) ||
    /class="[^"]*real-price/i.test(html)
  );
}
