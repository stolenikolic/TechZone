"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import useWishlist from "hooks/useWishlist";
import { HoverWrapper } from "./styles";
import Product from "models/Product.model";

type Props = {
  product: Product;
  showRemoveFromWishlist?: boolean;
  disableAddToCart?: boolean;
};

export default function HoverActions({ product, showRemoveFromWishlist = false, disableAddToCart = false }: Props) {
  const { id, slug } = product;

  const { dispatch } = useCart();
  const { removeFromWishlist } = useWishlist();
  const [isCartLoading, setCartLoading] = useState(false);
  const [isQuickViewLoading, setQuickViewLoading] = useState(false);
  const [isRemoveLoading, setRemoveLoading] = useState(false);

  const handleAddToCart = useCallback(async () => {
    if (disableAddToCart) return;
    setCartLoading(true);
    await addProductToCart(dispatch, product, { navigateToMiniCart: false });
    setCartLoading(false);
  }, [disableAddToCart, dispatch, product]);

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
          aria-label="Dodaj u korpu"
        >
          Dodaj u korpu
        </Button>
      </Link>

      {!showRemoveFromWishlist ? (
        <Link scroll={false} href={`/proizvodi/${slug}/view`} onNavigate={handleNavigate}>
          <Button
            fullWidth
            disableElevation
            color="inherit"
            variant="contained"
            className="view-btn"
            onClick={handleQuickView}
            loading={isQuickViewLoading}
            aria-label="Brzi pregled"
          >
            Brzi pregled
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
