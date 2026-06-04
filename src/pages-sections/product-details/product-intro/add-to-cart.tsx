"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { buildCartItemPayload } from "lib/cart/cart-item-payload";
import type { OfferChoiceKey, StorefrontProductOffer } from "lib/product-offers";
import Product from "models/Product.model";

type Props = {
  product: Product;
  qty?: number;
  selectedOffer: StorefrontProductOffer | null;
  offerChoice: OfferChoiceKey;
};

export default function AddToCart({ product, qty = 1, selectedOffer, offerChoice }: Props) {
  const offers = product.productOffers;
  const offer =
    selectedOffer ??
    (offers?.cheapestOfferId
      ? offers.offers.find((o) => o.id === offers.cheapestOfferId) ?? offers.offers[0] ?? null
      : null);

  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const { dispatch } = useCart();

  const handleAddToCart = () => {
    if (!offer || offer.sellingPrice <= 0) return;

    setLoading(true);
    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        addToExisting: true,
        payload: buildCartItemPayload({
          productId: product.id,
          title: product.title,
          slug: product.slug,
          thumbnail: product.thumbnail ?? "/assets/images/placeholder.png",
          qty,
          offer,
          offerChoice
        })
      });

      router.push("/mini-cart", { scroll: false });
      setLoading(false);
    }, 500);
  };

  const disabled = !offer || offer.sellingPrice <= 0;

  return (
    <Button
      color="primary"
      variant="contained"
      loading={isLoading}
      disabled={disabled}
      onClick={handleAddToCart}
      sx={{ px: "1.75rem", height: 40 }}
    >
      Add to Cart
    </Button>
  );
}
