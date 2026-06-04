"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Divider from "@mui/material/Divider";
// MUI ICON COMPONENTS
import Favorite from "@mui/icons-material/Favorite";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
// STYLED COMPONENT
import { HoverWrapper } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function HoverActions({ product }: Props) {
  const { slug } = product;
  const { dispatch } = useCart();
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = useCallback(() => {
    setFavorite((state) => !state);
  }, []);

  const handleAddToCart = useCallback(async () => {
    await addProductToCart(dispatch, product, { navigateToMiniCart: false });
  }, [dispatch, product]);

  return (
    <HoverWrapper className="controller">
      <Link className="hover-link" scroll={false} href={`/products/${slug}/view`}>
        <RemoveRedEye />
      </Link>

      <Divider orientation="horizontal" flexItem />

      <span className="hover-link" onClick={handleFavorite}>
        {isFavorite ? (
          <Favorite color="primary" fontSize="small" />
        ) : (
          <FavoriteBorder fontSize="small" color="primary" />
        )}
      </span>

      <Divider orientation="horizontal" flexItem />

      <Link className="hover-link" scroll={false} href="/mini-cart" onClick={handleAddToCart}>
        <AddShoppingCart />
      </Link>
    </HoverWrapper>
  );
}
