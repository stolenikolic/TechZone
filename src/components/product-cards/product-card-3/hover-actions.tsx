"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// MUI
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
// MUI ICON COMPONENTS
import Add from "@mui/icons-material/Add";
import Favorite from "@mui/icons-material/Favorite";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
// STYLED COMPONENTS
import { HoverButtonBox, ItemController } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function HoverActions({ product }: Props) {
  const { slug } = product;
  const { dispatch } = useCart();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  const handleAddToCart = async () => {
    setLoading(true);
    await addProductToCart(dispatch, product, { router });
    setLoading(false);
  };

  return (
    <HoverButtonBox className="hoverButtonBox">
      <div className="buttonBox">
        <ItemController>
          <span onClick={() => router.push(`/products/${slug}/view`, { scroll: false })}>
            <RemoveRedEye />
          </span>

          <Divider orientation="vertical" flexItem />

          <span onClick={handleFavorite}>
            {isFavorite ? (
              <Favorite color="primary" fontSize="small" />
            ) : (
              <FavoriteBorder color="primary" fontSize="small" />
            )}
          </span>

          <Divider orientation="vertical" flexItem />

          <span onClick={handleAddToCart}>
            <AddShoppingCart />
          </span>
        </ItemController>

        <Button
          color="primary"
          variant="outlined"
          loading={isLoading}
          onClick={handleAddToCart}
          className="addCartButton"
        >
          <Add /> Add to Cart
        </Button>
      </div>
    </HoverButtonBox>
  );
}
