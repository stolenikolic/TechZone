"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import useCart from "hooks/useCart";
import IconLink from "components/icon-link";
import { addProductToCart } from "lib/cart/add-product-to-cart";
import Product from "models/Product.model";

export default function ButtonGroup({ product }: { product: Product }) {
  const [isLoading, setLoading] = useState(false);
  const { dispatch } = useCart();
  const router = useRouter();

  const handleAddToCart = async () => {
    setLoading(true);
    await addProductToCart(dispatch, product, { router, navigateToMiniCart: false });
    setLoading(false);
  };

  return (
    <>
      <Button
        disableElevation
        size="large"
        color="primary"
        variant="contained"
        loading={isLoading}
        onClick={handleAddToCart}
      >
        Dodaj u korpu
      </Button>

      <IconLink title="Pogledaj detalje proizvoda" url={`/proizvodi/${product.slug}`} sx={{ mt: 2 }} />
    </>
  );
}
