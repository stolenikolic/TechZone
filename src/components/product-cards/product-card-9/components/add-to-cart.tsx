"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

type Props = { product: Product };

export default function AddToCartButton({ product }: Props) {
  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);
    await addProductToCart(dispatch, product, { router });
    setLoading(false);
  };

  return (
    <Button
      color="primary"
      variant="contained"
      loading={isLoading}
      aria-label="Dodaj u korpu"
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
