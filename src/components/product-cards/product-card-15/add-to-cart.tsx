"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

type Props = { product: Product };

export default function AddToCart({ product }: Props) {
  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleCart = async () => {
    setIsLoading(true);
    await addProductToCart(dispatch, product, { router });
    setIsLoading(false);
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
