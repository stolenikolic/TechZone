"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// MUI
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Favorite from "@mui/icons-material/Favorite";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
// STYLED COMPONENT
import { ItemController } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function HoverActions({ product }: Props) {
  const { slug } = product;
  const { dispatch } = useCart();
  const router = useRouter();
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  const handleAddToCart = async () => {
    await addProductToCart(dispatch, product, { router });
  };

  return (
    <ItemController className="controlBox">
      <Typography
        component="span"
        onClick={() => router.push(`/products/${slug}/view`, { scroll: false })}
      >
        <RemoveRedEye />
      </Typography>

      <Divider orientation="horizontal" flexItem />

      <Typography component="span" onClick={handleFavorite}>
        {isFavorite ? (
          <Favorite color="primary" fontSize="small" />
        ) : (
          <FavoriteBorder fontSize="small" color="primary" />
        )}
      </Typography>

      <Divider orientation="horizontal" flexItem />

      <Typography component="span" onClick={handleAddToCart}>
        <AddShoppingCart />
      </Typography>
    </ItemController>
  );
}
