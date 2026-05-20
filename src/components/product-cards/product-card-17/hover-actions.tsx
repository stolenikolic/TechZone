"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import useWishlist from "hooks/useWishlist";
import { HoverWrapper } from "./styles";
import Product from "models/Product.model";

type Props = {
  product: Product;
  showRemoveFromWishlist?: boolean;
  disableAddToCart?: boolean;
};

export default function HoverActions({ product, showRemoveFromWishlist = false, disableAddToCart = false }: Props) {
  const { id, slug, title, price, thumbnail } = product;

  const { dispatch } = useCart();
  const { removeFromWishlist } = useWishlist();
  const [isCartLoading, setCartLoading] = useState(false);
  const [isQuickViewLoading, setQuickViewLoading] = useState(false);
  const [isRemoveLoading, setRemoveLoading] = useState(false);

  const handleAddToCart = useCallback(() => {
    if (disableAddToCart) return;
    setCartLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        addToExisting: true,
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      setCartLoading(false);
    }, 500);
  }, [disableAddToCart, dispatch, slug, id, price, title, thumbnail]);

  const handleQuickView = useCallback(() => {
    setQuickViewLoading(true);
  }, []);

  const handleNavigate = useCallback(() => {
    setQuickViewLoading(false);
  }, []);

  const handleRemove = useCallback(async () => {
    setRemoveLoading(true);
    try {
      await removeFromWishlist(id);
    } finally {
      setRemoveLoading(false);
    }
  }, [id, removeFromWishlist]);

  return (
    <HoverWrapper className="hover-box" compact={showRemoveFromWishlist}>
      <Link scroll={false} href="/mini-cart">
        <Button
          fullWidth
          size={showRemoveFromWishlist ? "small" : "medium"}
          color="primary"
          variant="contained"
          loading={isCartLoading}
          onClick={handleAddToCart}
          disabled={disableAddToCart}
          aria-label={showRemoveFromWishlist ? "Dodaj u korpu" : "Add to cart"}
        >
          {showRemoveFromWishlist ? "Dodaj u korpu" : "Add to cart"}
        </Button>
      </Link>

      {!showRemoveFromWishlist ? (
        <Link scroll={false} href={`/products/${slug}/view`} onNavigate={handleNavigate}>
          <Button
            fullWidth
            disableElevation
            color="inherit"
            variant="contained"
            className="view-btn"
            onClick={handleQuickView}
            loading={isQuickViewLoading}
            aria-label="Quick view"
          >
            Quick View
          </Button>
        </Link>
      ) : null}

      {showRemoveFromWishlist ? (
        <Button
          fullWidth
          size="small"
          color="error"
          variant="outlined"
          loading={isRemoveLoading}
          onClick={() => void handleRemove()}
          aria-label="Ukloni iz liste želja"
        >
          Ukloni
        </Button>
      ) : null}
    </HoverWrapper>
  );
}
