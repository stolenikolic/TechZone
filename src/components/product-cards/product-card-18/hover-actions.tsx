"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import SvgIcon from "@mui/material/SvgIcon";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// STYLED COMPONENTS
import { HoverButtonsWrapper } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ========================================================
interface Props {
  product: Product;
}
// ========================================================

export default function HoverActions({ product }: Props) {
  const { id, slug, title, price, thumbnail } = product;

  const [isLoading, setLoading] = useState(false);
  const { dispatch } = useCart();

  const handleAddToCart = useCallback(() => {
    setLoading(true);

    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: { id, slug, price, title, thumbnail, qty: 1 }
      });

      setLoading(false);
    }, 500);
  }, [dispatch, slug, id, price, title, thumbnail]);

  return (
    <HoverButtonsWrapper className="hover-buttons">
      <Link scroll={false} href="/mini-cart" className="add-to-cart-btn">
        <Button
          fullWidth
          color="primary"
          variant="contained"
          loading={isLoading}
          onClick={handleAddToCart}
          aria-label="Add to cart"
        >
          Add to cart
        </Button>
      </Link>

      <Link scroll={false} href={`/products/${slug}/view`}>
        <Button disableElevation color="primary" variant="contained" aria-label="Quick view">
          <SvgIcon width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0"
            />
          </SvgIcon>
        </Button>
      </Link>
    </HoverButtonsWrapper>
  );
}
