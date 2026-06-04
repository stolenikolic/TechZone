"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Add from "@mui/icons-material/Add";
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
      loading={isLoading}
      variant="contained"
      sx={{ padding: 0.5, minHeight: 0 }}
      onClick={handleAddToCart}
    >
      <Add fontSize="small" />
    </Button>
  );
}
