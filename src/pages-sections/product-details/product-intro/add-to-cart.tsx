"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ================================================================
type Props = { product: Product; qty?: number };
// ================================================================

export default function AddToCart({ product, qty = 1 }: Props) {
  const { id, price, title, slug, thumbnail } = product;

  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const { dispatch } = useCart();

  const handleAddToCart = () => {
    setLoading(true);
    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        addToExisting: true,
        payload: { id, slug, price, title, thumbnail, qty }
      });

      router.push("/mini-cart", { scroll: false });
      setLoading(false);
    }, 500);
  };

  return (
    <Button
      color="primary"
      variant="contained"
      loading={isLoading}
      onClick={handleAddToCart}
      sx={{ px: "1.75rem", height: 40 }}
    >
      Add to Cart
    </Button>
  );
}
