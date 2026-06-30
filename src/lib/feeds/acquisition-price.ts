import { round2 } from "lib/pricing/sell-price";

export type FeedRegionalOffer = {
  acquisition_price: number;
  acquisition_currency: string;
  supplier_code: string;
};

export type SupplierOfferInput = {
  supplier_id: string;
  price_amount: number;
  currency: string;
  supplier_code: string;
  pricing_formula: string | null | undefined;
};

/**
 * Comparable HU acquisition for one offer (iPon raw HUF; other HU × alza_tax).
 */
export function computeHuComparableHuf(
  priceAmount: number,
  pricingFormula: string | null | undefined,
  alzaTax: number
): number | null {
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) return null;
  if (pricingFormula === "hungary_huf_alza_tax") {
    if (!Number.isFinite(alzaTax) || alzaTax <= 0) return null;
    return Math.round(priceAmount * alzaTax);
  }
  return Math.round(priceAmount);
}

/** Net KM acquisition for one BA offer. */
export function computeBaNetKm(priceAmount: number): number | null {
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) return null;
  return round2(priceAmount);
}

function isHuCurrency(currency: string): boolean {
  return currency?.trim().toUpperCase() === "HUF";
}

function isBaCurrency(currency: string): boolean {
  const cur = currency?.trim().toUpperCase() || "";
  return cur === "KM" || cur === "BAM";
}

/** Lowest HU offer after normalizing non-iPon with alza_tax; tie → lower supplier_id. */
export function pickBestHuOffer(
  offers: SupplierOfferInput[],
  alzaTax: number
): FeedRegionalOffer | null {
  let best: { supplierId: string; offer: FeedRegionalOffer } | null = null;

  for (const row of offers) {
    if (!isHuCurrency(row.currency)) continue;
    const code = row.supplier_code?.trim();
    if (!code) continue;

    const comparable = computeHuComparableHuf(row.price_amount, row.pricing_formula, alzaTax);
    if (comparable == null) continue;

    const candidate: FeedRegionalOffer = {
      acquisition_price: comparable,
      acquisition_currency: "HUF",
      supplier_code: code
    };

    if (
      !best ||
      comparable < best.offer.acquisition_price ||
      (comparable === best.offer.acquisition_price && row.supplier_id < best.supplierId)
    ) {
      best = { supplierId: row.supplier_id, offer: candidate };
    }
  }

  return best?.offer ?? null;
}

/** Lowest net KM among BA offers; tie → lower supplier_id. */
export function pickBestBaOffer(offers: SupplierOfferInput[]): FeedRegionalOffer | null {
  let best: { supplierId: string; offer: FeedRegionalOffer } | null = null;

  for (const row of offers) {
    if (!isBaCurrency(row.currency)) continue;
    const code = row.supplier_code?.trim();
    if (!code) continue;

    const netKm = computeBaNetKm(row.price_amount);
    if (netKm == null) continue;

    const candidate: FeedRegionalOffer = {
      acquisition_price: netKm,
      acquisition_currency: "KM",
      supplier_code: code
    };

    if (
      !best ||
      netKm < best.offer.acquisition_price ||
      (netKm === best.offer.acquisition_price && row.supplier_id < best.supplierId)
    ) {
      best = { supplierId: row.supplier_id, offer: candidate };
    }
  }

  return best?.offer ?? null;
}

export function buildRegionalOffers(
  offers: SupplierOfferInput[],
  alzaTax: number
): { HU?: FeedRegionalOffer; BA?: FeedRegionalOffer } {
  const hu = pickBestHuOffer(offers, alzaTax);
  const ba = pickBestBaOffer(offers);
  return {
    ...(hu ? { HU: hu } : {}),
    ...(ba ? { BA: ba } : {})
  };
}
