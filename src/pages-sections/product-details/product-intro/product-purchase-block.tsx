"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShipping from "@mui/icons-material/LocalShipping";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Lock from "@mui/icons-material/Lock";
import DeliveryRangeText from "components/delivery/delivery-range-text";
import { deliveryBandFromCalendarDays } from "lib/product-offers/delivery-band";
import QuantityButtons from "pages-sections/cart/quantity-buttons";
import AddToCart from "./add-to-cart";
import type { OfferChoiceKey, StorefrontProductOffer } from "lib/product-offers";
import Product from "models/Product.model";

// ================================================================
type Props = {
  product: Product;
  /** Calendar days until the internal delivery date. Null means the range is unknown. */
  deliveryDaysFromToday: number | null;
  selectedOffer: StorefrontProductOffer | null;
  offerChoice: OfferChoiceKey;
};
// ================================================================

/**
 * Uses the same QuantityButtons component as the cart for identical UI.
 */
export default function ProductPurchaseBlock({
  product,
  deliveryDaysFromToday,
  selectedOffer,
  offerChoice
}: Props) {
  const [qty, setQty] = useState(1);
  const offers = product.productOffers;

  const warrantyLine = offers?.warrantyTrustLabel ?? "2 godine garancije";
  const deliveryBand =
    deliveryDaysFromToday == null ? null : deliveryBandFromCalendarDays(deliveryDaysFromToday);

  return (
    <Stack spacing={6} sx={{ mb: 4.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <QuantityButtons
          value={qty}
          min={1}
          max={99}
          onDecrement={() => setQty((n) => Math.max(1, n - 1))}
          onIncrement={() => setQty((n) => Math.min(99, n + 1))}
        />
        <AddToCart
          product={product}
          qty={qty}
          selectedOffer={selectedOffer}
          offerChoice={offerChoice}
        />
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <LocalShipping fontSize="small" sx={{ color: "text.secondary" }} />
          {deliveryBand ? (
            <DeliveryRangeText
              tone={deliveryBand.tone}
              rangeLabel={deliveryBand.rangeLabel}
              lead="Isporuka za"
            />
          ) : (
            "Rok isporuke: na upit"
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <VerifiedUser fontSize="small" sx={{ color: "text.secondary" }} />
          {warrantyLine}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Lock fontSize="small" sx={{ color: "text.secondary" }} />
          Plaćanje pouzećem ili žiralno
        </Typography>
      </Stack>
    </Stack>
  );
}
