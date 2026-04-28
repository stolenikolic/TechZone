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

export default function AddToCartButton({ product }: Props) {
  const { thumbnail, title, price, id, slug } = product;

  const { dispatch } = useCart();

  const router = useRouter();
  const [isLoading, setLoading] = useState(false);

  const handleAddToCart = () => {
    setLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      router.push("/mini-cart", { scroll: false });
      setLoading(false);
    }, 500);
  };

  return (
    <Button
      color="primary"
      loading={isLoading}
      variant="contained"
      sx={{ padding: 0.5, minHeight: 0 }}
      onClick={handleAddToCart}
    >
      <Add fontSize="small" />
    </Button>
  );
}
