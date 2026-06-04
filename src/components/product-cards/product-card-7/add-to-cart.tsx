"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Add from "@mui/icons-material/Add";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import { StyledButton } from "./styles";
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
    <StyledButton loading={isLoading} variant="outlined" onClick={handleAddToCart}>
      <Add fontSize="small" />
    </StyledButton>
  );
}
