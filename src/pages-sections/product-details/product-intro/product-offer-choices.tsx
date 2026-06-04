"use client";

import { useMemo } from "react";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import type { OfferChoiceKey, ProductOffersSummary, StorefrontProductOffer } from "lib/product-offers";

export type { OfferChoiceKey };

type Props = {
  productOffers: ProductOffersSummary;
  selected: OfferChoiceKey;
  onSelect: (key: OfferChoiceKey, offer: StorefrontProductOffer) => void;
};

/**
 * Bazaar "Type" row — mutually exclusive Chip selection (like type 1 / type 2).
 */
export default function ProductOfferChoices({ productOffers, selected, onSelect }: Props) {
  const { offers, cheapestOfferId, fastestOfferId } = productOffers;

  const cheapest = useMemo(
    () => offers.find((o) => o.id === cheapestOfferId) ?? offers[0] ?? null,
    [offers, cheapestOfferId]
  );
  const fastest = useMemo(
    () => offers.find((o) => o.id === fastestOfferId) ?? cheapest,
    [offers, fastestOfferId, cheapest]
  );

  const sameOffer = cheapest != null && fastest != null && cheapest.id === fastest.id;

  const handleSelect = (key: OfferChoiceKey) => {
    if (key === "fastest" && sameOffer) return;
    const offer = key === "fastest" && fastest ? fastest : cheapest;
    if (offer) onSelect(key, offer);
  };

  if (!cheapest) return null;

  return (
    <div className="mb-1">
      <Typography variant="h6" sx={{ mb: 1 }}>
        Opcija kupovine
      </Typography>

      <div className="variant-group">
        <Chip
          label="Najjeftinije"
          size="small"
          color="primary"
          onClick={() => handleSelect("cheapest")}
          variant={selected === "cheapest" ? "filled" : "outlined"}
        />

        <Tooltip title={sameOffer ? "Najbrza dostava je ista kao najjeftinija." : ""} disableHoverListener={!sameOffer}>
          <span>
            <Chip
              label="Najbrza dostava"
              size="small"
              color="primary"
              disabled={sameOffer}
              onClick={() => handleSelect("fastest")}
              variant={selected === "fastest" ? "filled" : "outlined"}
            />
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
