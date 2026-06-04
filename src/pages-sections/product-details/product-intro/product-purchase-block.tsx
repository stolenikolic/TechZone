"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShipping from "@mui/icons-material/LocalShipping";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Lock from "@mui/icons-material/Lock";
import QuantityButtons from "pages-sections/cart/quantity-buttons";
import ViberChatButton from "components/contact/viber-chat-button";
import AddToCart from "./add-to-cart";
import WishlistButton from "./wishlist-button";
import type { OfferChoiceKey, StorefrontProductOffer } from "lib/product-offers";
import Product from "models/Product.model";

// ================================================================
type Props = {
  product: Product;
  deliveryLine: string;
  selectedOffer: StorefrontProductOffer | null;
  offerChoice: OfferChoiceKey;
};
// ================================================================

/**
 * Uses the same QuantityButtons component as the cart for identical UI.
 */
export default function ProductPurchaseBlock({
  product,
  deliveryLine,
  selectedOffer,
  offerChoice
}: Props) {
  const [qty, setQty] = useState(1);
  const offers = product.productOffers;

  const warrantyLine =
    offers?.warrantyTrustLabel ?? "Warranty: 36 months";

  return (
    <Stack spacing={1.5} sx={{ mb: 4.5 }}>
      <QuantityButtons
        value={qty}
        min={1}
        max={99}
        onDecrement={() => setQty((n) => Math.max(1, n - 1))}
        onIncrement={() => setQty((n) => Math.min(99, n + 1))}
      />
      <Stack direction="row" spacing={1.5}>
        <AddToCart
          product={product}
          qty={qty}
          selectedOffer={selectedOffer}
          offerChoice={offerChoice}
        />
        <WishlistButton productId={product.id} />
      </Stack>

      <ViberChatButton
        productTitle={product.title}
        productSlug={product.slug}
        fullWidth
        sx={{ mt: 0.5 }}
      />

      <Stack spacing={0.75} sx={{ mt: 3.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <LocalShipping fontSize="small" sx={{ color: "text.secondary" }} />
          {deliveryLine}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <VerifiedUser fontSize="small" sx={{ color: "text.secondary" }} />
          {warrantyLine}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Lock fontSize="small" sx={{ color: "text.secondary" }} />
          Secure payment
        </Typography>
      </Stack>
    </Stack>
  );
}
