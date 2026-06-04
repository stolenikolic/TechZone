import {
  daysBetween,
  estimateTechZoneDeliveryDate,
  formatDeliveryDate,
  formatDeliveryLabel,
  toDeliveryDateStorageKey
} from "./delivery-estimate";
import { computeOriginalPriceKm, DEFAULT_ORIGINAL_PRICE_MARKUP_PERCENT } from "lib/pricing";
import { IPON_ROW_NULL_LEAD_DAYS, OTHER_SUPPLIER_FALLBACK_LEAD_DAYS } from "./supplier-lead-days";
import type { ProductOffersSummary, StorefrontProductOffer } from "./types";

const FALLBACK_CHEAPEST_ID = "fallback-cheapest";
const FALLBACK_FASTEST_ID = "fallback-fastest";

function makeSyntheticOffer(
  id: string,
  sellingPrice: number,
  supplierLeadDays: number
): StorefrontProductOffer {
  const today = new Date();
  const policy = { type: "weekly" as const, weekday: 1 };
  const estimatedDate = estimateTechZoneDeliveryDate(policy, supplierLeadDays, today);
  const estimatedDaysFromToday = daysBetween(today, estimatedDate);
  return {
    id,
    sellingPrice,
    originalPrice: computeOriginalPriceKm(sellingPrice, DEFAULT_ORIGINAL_PRICE_MARKUP_PERCENT),
    deliveryDays: supplierLeadDays,
    warrantyMonths: null,
    estimatedDeliveryDate: toDeliveryDateStorageKey(estimatedDate),
    estimatedDaysFromToday,
    deliveryLabel: formatDeliveryLabel(estimatedDate, estimatedDaysFromToday)
  };
}

/** Storefront UI when DB offers are missing or migration not applied yet. */
export function buildFallbackProductOffers(sellingPrice: number): ProductOffersSummary {
  const cheapest = makeSyntheticOffer(FALLBACK_CHEAPEST_ID, sellingPrice, IPON_ROW_NULL_LEAD_DAYS);
  const fastest = makeSyntheticOffer(FALLBACK_FASTEST_ID, sellingPrice, OTHER_SUPPLIER_FALLBACK_LEAD_DAYS);

  const trustOffer = fastest.estimatedDaysFromToday <= cheapest.estimatedDaysFromToday ? fastest : cheapest;

  return {
    offers: [cheapest, fastest],
    cheapestOfferId: FALLBACK_CHEAPEST_ID,
    fastestOfferId: FALLBACK_FASTEST_ID,
    deliveryTrustLabel: formatRokIsporuke(trustOffer),
    warrantyTrustLabel: null
  };
}

export function formatRokIsporuke(offer: Pick<StorefrontProductOffer, "deliveryLabel">): string {
  const datePart = offer.deliveryLabel.replace(/^Procijenjena isporuka: /, "");
  return `Rok isporuke: ${datePart}`;
}

export function formatRokIsporukeFromDate(daysFromToday: number, date: Date): string {
  if (daysFromToday <= 0) {
    return `Rok isporuke: ${formatDeliveryDate(date)}`;
  }
  if (daysFromToday === 1) {
    return `Rok isporuke: sutra (${formatDeliveryDate(date)})`;
  }
  return `Rok isporuke: ${formatDeliveryDate(date)} (za ~${daysFromToday} dana)`;
}
