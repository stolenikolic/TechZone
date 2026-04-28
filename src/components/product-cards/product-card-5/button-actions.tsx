"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// MUI
import Button from "@mui/material/Button";
// MUI ICON COMPONENTS
import Add from "@mui/icons-material/Add";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// STYLED COMPONENT
import { ButtonGroup } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ButtonActions({ product }: Props) {
  const { id, title, price, thumbnail, slug } = product;

  const { dispatch } = useCart();

  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const [isFavorite, setFavorite] = useState(false);

  const handleAddToCart = () => {
    setLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      router.push("/mini-cart", { scroll: false });
      setLoading(false);
    }, 500);
  };

  return (
    <ButtonGroup>
      <Button
        disableElevation
        loading={isLoading}
        variant="contained"
        onClick={handleAddToCart}
        sx={{ py: "5px", fontSize: 13, width: "100%", lineHeight: 1 }}
      >
        <Add fontSize="small" sx={{ marginInlineEnd: 0.5 }} /> Add to Cart
      </Button>

      <Button
        disableElevation
        variant="contained"
        onClick={() => setFavorite(!isFavorite)}
        sx={{ p: "5px 8px" }}
      >
        {isFavorite ? <Favorite sx={{ fontSize: 16 }} /> : <FavoriteBorder sx={{ fontSize: 16 }} />}
      </Button>
    </ButtonGroup>
  );
}
