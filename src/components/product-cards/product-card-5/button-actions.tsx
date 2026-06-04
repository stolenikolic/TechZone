"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Add from "@mui/icons-material/Add";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import { ButtonGroup } from "./styles";
import Product from "models/Product.model";

type Props = { product: Product };

export default function ButtonActions({ product }: Props) {
  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const [isFavorite, setFavorite] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);
    await addProductToCart(dispatch, product, { router });
    setLoading(false);
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
