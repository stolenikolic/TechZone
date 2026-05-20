"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShipping from "@mui/icons-material/LocalShipping";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Lock from "@mui/icons-material/Lock";
import QuantityButtons from "pages-sections/cart/quantity-buttons";
import AddToCart from "./add-to-cart";
import WishlistButton from "./wishlist-button";
import Product from "models/Product.model";

// ================================================================
type Props = { product: Product };
// ================================================================

/**
 * Uses the same QuantityButtons component as the cart for identical UI.
 */
export default function ProductPurchaseBlock({ product }: Props) {
  const [qty, setQty] = useState(1);

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
        <AddToCart product={product} qty={qty} />
        <WishlistButton productId={product.id} />
      </Stack>

      <Stack spacing={0.75} sx={{ mt: 3.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <LocalShipping fontSize="small" sx={{ color: "text.secondary" }} />
          Delivery: 2–4 working days
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <VerifiedUser fontSize="small" sx={{ color: "text.secondary" }} />
          Warranty: 36 months
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Lock fontSize="small" sx={{ color: "text.secondary" }} />
          Secure payment
        </Typography>
      </Stack>
    </Stack>
  );
}
