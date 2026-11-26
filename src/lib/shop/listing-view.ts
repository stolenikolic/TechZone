export const LISTING_VIEW_STORAGE_KEY = "tz-listing-view";

/** Matches MUI `breakpoints.down("sm")` (phones under 600px). */
export const LISTING_VIEW_PHONE_QUERY = "(max-width:599.95px)";

export type ListingView = "grid" | "list";

export function parseListingView(value: string | null | undefined): ListingView | null {
  return value === "grid" || value === "list" ? value : null;
}

/** Phones only. Tablets (iPad, Android without Mobile) stay on the grid default. */
export function isPhoneUserAgent(userAgent: string): boolean {
  const ua = userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  return /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(ua);
}
