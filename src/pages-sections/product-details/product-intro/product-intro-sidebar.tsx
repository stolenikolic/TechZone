"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatPrice } from "lib";
import { formatRokIsporuke, hasDistinctPurchaseOffers } from "lib/product-offers";
import Product from "models/Product.model";
import type { StorefrontProductOffer } from "lib/product-offers";
import ProductOfferChoices, { type OfferChoiceKey } from "./product-offer-choices";
import ProductPurchaseBlock from "./product-purchase-block";

type Props = { product: Product };

function resolveDefaultChoice(offers: Product["productOffers"]): {
  key: OfferChoiceKey;
  offer: StorefrontProductOffer | null;
} {
  if (!offers?.offers.length) return { key: "cheapest", offer: null };
  const cheapest =
    offers.offers.find((o) => o.id === offers.cheapestOfferId) ?? offers.offers[0] ?? null;
  return { key: "cheapest", offer: cheapest };
}

export default function ProductIntroSidebar({ product }: Props) {
  const offers = product.productOffers;
  const showOfferChoices = hasDistinctPurchaseOffers(offers);
  const defaults = useMemo(() => resolveDefaultChoice(offers), [offers]);

  const [selectedKey, setSelectedKey] = useState<OfferChoiceKey>("cheapest");
  const [selectedOffer, setSelectedOffer] = useState<StorefrontProductOffer | null>(defaults.offer);

  const activeOffer = selectedOffer ?? defaults.offer;

  const handleSelect = useCallback((key: OfferChoiceKey, offer: StorefrontProductOffer) => {
    setSelectedKey(key);
    setSelectedOffer(offer);
  }, []);

  useEffect(() => {
    setSelectedKey(defaults.key);
    setSelectedOffer(defaults.offer);
  }, [product.slug, defaults.key, defaults.offer?.id]);

  const displayPrice =
    activeOffer && activeOffer.sellingPrice > 0 ? activeOffer.sellingPrice : product.price ?? 0;
  const showPricePlaceholder = displayPrice == null || displayPrice === 0;
  const referenceOriginal =
    activeOffer && activeOffer.originalPrice > 0
      ? activeOffer.originalPrice
      : product.originalPrice;
  const originalPrice =
    referenceOriginal != null && referenceOriginal > displayPrice ? referenceOriginal : null;

  const deliveryLine = (
    activeOffer
      ? formatRokIsporuke(activeOffer)
      : offers?.deliveryTrustLabel ?? "Delivery: 2–4 working days"
  ).replace(/^Rok isporuke:/, "Delivery:");

  return (
    <>
      <div className="price">
        {showPricePlaceholder ? (
          <Typography variant="h2" sx={{ color: "price.main", mb: 0.5, lineHeight: 1 }}>
            Price on request
          </Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 1.5
            }}
          >
            <Typography variant="h2" sx={{ color: "price.main", fontWeight: 700, lineHeight: 1 }}>
              {formatPrice(displayPrice)}
            </Typography>
            {originalPrice != null ? (
              <Typography
                component="span"
                sx={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "primary.main",
                  textDecoration: "line-through"
                }}
              >
                {formatPrice(originalPrice)}
              </Typography>
            ) : null}
          </Box>
        )}
      </div>

      {offers && showOfferChoices ? (
        <ProductOfferChoices
          productOffers={offers}
          selected={selectedKey}
          onSelect={handleSelect}
        />
      ) : null}

      <ProductPurchaseBlock
        product={product}
        deliveryLine={deliveryLine}
        selectedOffer={activeOffer}
        offerChoice={selectedKey}
      />
    </>
  );
}
