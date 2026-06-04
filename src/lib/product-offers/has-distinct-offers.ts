import type { ProductOffersSummary } from "./types";

/** True when cheapest and fastest resolve to different supplier offers. */
export function hasDistinctPurchaseOffers(offers: ProductOffersSummary | null | undefined): boolean {
  if (!offers?.offers.length) return false;
  if (!offers.cheapestOfferId || !offers.fastestOfferId) return false;
  return offers.cheapestOfferId !== offers.fastestOfferId;
}
