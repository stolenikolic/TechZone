"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

type Props = { product: Product };

export default function AddToCart({ product }: Props) {
  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    await addProductToCart(dispatch, product, { router });
    setIsLoading(false);
  };

  return (
    <Button
      color="primary"
      variant="outlined"
      loading={isLoading}
      onClick={handleAddToCart}
      sx={{
        flexShrink: 0,
        minWidth: 34,
        minHeight: 34,
        padding: "4px"
      }}
    >
      <AddShoppingCart fontSize="small" />
    </Button>
  );
}
