"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// MUI
import Add from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function AddToCart({ product }: Props) {
  const { slug, title, thumbnail, price, id } = product;

  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = () => {
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
      color="primary"
      variant="outlined"
      loading={isLoading}
      onClick={handleAddToCart}
      sx={{ padding: "3px" }}
    >
      <Add fontSize="small" />
    </Button>
  );
}
