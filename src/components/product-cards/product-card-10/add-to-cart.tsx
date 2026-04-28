"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function AddToCart({ product }: Props) {
  const { slug, id, price, thumbnail, title } = product;

  const { dispatch } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = useCallback(() => {
    setIsLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      setIsLoading(false);
    }, 500);
  }, [dispatch, slug, id, price, title, thumbnail]);

  return (
    <Link scroll={false} href="/mini-cart" className="add-to-cart-btn">
      <Button
        fullWidth
        color="primary"
        variant="contained"
        loading={isLoading}
        onClick={handleAddToCart}
        aria-label="Add to cart"
      >
        Add to cart
      </Button>
    </Link>
  );
}
