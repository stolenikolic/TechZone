/**
 * iPon detail scrape: HTTP ponašanje (delay, referer rotacija).
 * Konfiguracija atributa po kategoriji uklonjena — sada dolazi iz `category_attributes`
 * tablice putem `loadCategoryAttributeSlugs` iz registry-ja.
 */

export function randomDelay(minMs: number, jitterMs: number): number {
  return minMs + Math.floor(Math.random() * jitterMs);
}

/** Rotacija Referer-a kao u browseru (listing, origin, /shop/). */
export function getRandomReferer(categoryListingUrl: string): string {
  const base = new URL(categoryListingUrl).origin;
  const referers = [categoryListingUrl, base, `${base}/shop/`];
  return referers[Math.floor(Math.random() * referers.length)];
}
