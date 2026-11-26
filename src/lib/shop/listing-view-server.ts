import { cookies, headers } from "next/headers";
import { isPhoneUserAgent, LISTING_VIEW_STORAGE_KEY, parseListingView, type ListingView } from "./listing-view";

/** Saved choice wins. Otherwise phones open the list and every wider device opens the grid. */
export async function getInitialListingView(): Promise<ListingView> {
  const saved = parseListingView((await cookies()).get(LISTING_VIEW_STORAGE_KEY)?.value);
  if (saved) return saved;
  const userAgent = (await headers()).get("user-agent") ?? "";
  return isPhoneUserAgent(userAgent) ? "list" : "grid";
}
