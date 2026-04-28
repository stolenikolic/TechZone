"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// MUI
import Button from "@mui/material/Button";
// LOCAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function AddToCart({ product }: Props) {
  const { id, slug, title, thumbnail, price } = product;

  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleCart = () => {
    setIsLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      router.push("/mini-cart", { scroll: false });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Button
      fullWidth
      color="primary"
      disableElevation
      variant="contained"
      loading={isLoading}
      onClick={handleCart}
    >
      Add To Cart
    </Button>
  );
}
