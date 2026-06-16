export type OfferChoiceKey = "cheapest" | "fastest";

/** Supplier inbound schedule — weekly = ponedjeljak kod nas; daily = bez sedmičnog čekanja (BiH lokalni). */
export type DeliveryPolicy =
  | {
      type: "weekly";
      weekday: number;
    }
  | {
      type: "daily";
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
