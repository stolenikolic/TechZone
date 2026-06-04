export type OfferChoiceKey = "cheapest" | "fastest";

/** Supplier inbound schedule — roba kod nas (uvijek sedmični ponedjeljak). */
export type DeliveryPolicy = {
  type: "weekly";
  weekday: number;
};

export type StorefrontProductOffer = {
  id: string;
  sellingPrice: number;
  /** Reference (strikethrough) price for this offer — selling × (1 + markup%). */
  originalPrice: number;
  deliveryDays: number | null;
  warrantyMonths: number | null;
  estimatedDeliveryDate: string;
  estimatedDaysFromToday: number;
  deliveryLabel: string;
};

export type ProductOffersSummary = {
  offers: StorefrontProductOffer[];
  cheapestOfferId: string | null;
  fastestOfferId: string | null;
  deliveryTrustLabel: string | null;
  warrantyTrustLabel: string | null;
};
