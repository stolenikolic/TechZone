"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import Favorite from "@mui/icons-material/Favorite";
import ShoppingCart from "@mui/icons-material/ShoppingCart";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import { HoverWrapper } from "./styles";
import Product from "models/Product.model";

type Props = { product: Product };

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
    <HoverWrapper className="controller">
      <span onClick={() => router.push(`/products/${slug}/view`, { scroll: false })}>
        <RemoveRedEye />
      </span>

      <Typography
        component="span"
        onClick={handleFavorite}
        sx={{ cursor: "pointer", display: "flex" }}
      >
        {isFavorite ? <Favorite color="primary" fontSize="small" /> : <FavoriteBorder fontSize="small" />}
      </Typography>

      <span onClick={handleAddToCart}>
        <ShoppingCart />
      </span>
    </HoverWrapper>
  );
}
