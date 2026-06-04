"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

type Props = { product: Product };

export default function AddToCart({ product }: Props) {
  const { dispatch } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = useCallback(async () => {
    setIsLoading(true);
    await addProductToCart(dispatch, product, { navigateToMiniCart: false });
    setIsLoading(false);
  }, [dispatch, product]);

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
