"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
// MUI ICON COMPONENTS
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// CUSTOM COMPONENTS
import { FavoriteButton, AddToCartButton, QuickViewButton } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function HoverActions({ product }: Props) {
  const { slug, id, title, price, thumbnail } = product;

  const { dispatch } = useCart();

  const router = useRouter();
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  const handleAddToCart = () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: { id, slug, price, title, thumbnail, qty: 1 }
    });

    router.push("/mini-cart", { scroll: false });
  };

  return (
    <Fragment>
      {/* ADD TO CART BUTTON */}
      <AddToCartButton className="product-actions" onClick={handleAddToCart}>
        <AddShoppingCart className="icon" fontSize="small" />
      </AddToCartButton>

      {/* PRODUCT FAVORITE BUTTON */}
      <FavoriteButton className="product-actions" onClick={handleFavorite}>
        {isFavorite ? (
          <Favorite className="icon" fontSize="small" color="primary" />
        ) : (
          <FavoriteBorder className="icon" fontSize="small" />
        )}
      </FavoriteButton>

      {/* PRODUCT QUICK VIEW BUTTON */}
      <div className="quick-view-btn">
        <QuickViewButton
          fullWidth
          size="large"
          color="dark"
          variant="contained"
          className="product-view-action"
          onClick={() => router.push(`/products/${slug}/view`, { scroll: false })}
        >
          Quick View
        </QuickViewButton>
      </div>
    </Fragment>
  );
}
