"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Add from "@mui/icons-material/Add";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

type Props = { product: Product };

export default function AddToCart({ product }: Props) {
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
      variant="outlined"
      loading={isLoading}
      onClick={handleAddToCart}
      sx={{ padding: "3px", alignSelf: "self-end" }}
    >
      <Add fontSize="small" />
    </Button>
  );
}
