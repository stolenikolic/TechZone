import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFallbackProductOffers } from "./fallback-offers";
import { computeProductOffersForStorefront } from "./compute-product-offers";
import type { ProductOffersSummary } from "./types";

/**
 * Always returns a summary suitable for PDP (buttons + rok isporuke).
 * Uses supplier offers when present; otherwise synthesizes from master price.
 */
export async function resolveProductOffersForStorefront(
  supabase: SupabaseClient,
  productId: string,
  masterSellingPrice: number
): Promise<ProductOffersSummary> {
  const computed = await computeProductOffersForStorefront(supabase, productId);

  if (computed?.offers?.length) {
    return {
      ...computed,
      deliveryTrustLabel:
        computed.deliveryTrustLabel ??
        buildFallbackProductOffers(masterSellingPrice).deliveryTrustLabel
    };
  }

  if (masterSellingPrice > 0) {
    return buildFallbackProductOffers(masterSellingPrice);
  }

  return {
    offers: [],
    cheapestOfferId: null,
    fastestOfferId: null,
    deliveryTrustLabel: "Rok isporuke: na upit",
    warrantyTrustLabel: null
  };
}
