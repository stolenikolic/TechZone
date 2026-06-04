"use client";

import Link from "next/link";
import { useState } from "react";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";
import { StyledButton } from "./styles";

type Props = { product: Product };

export default function AddToCart({ product }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { dispatch } = useCart();

  const handleCart = async () => {
    setIsLoading(true);
    await addProductToCart(dispatch, product, { navigateToMiniCart: false });
    setIsLoading(false);
  };

  return (
    <Link href="/mini-cart" scroll={false}>
      <StyledButton
        fullWidth
        disableElevation
        color="primary"
        loading={isLoading}
        onClick={handleCart}
        className="add-to-cart"
      >
        Add To Cart
      </StyledButton>
    </Link>
  );
}
