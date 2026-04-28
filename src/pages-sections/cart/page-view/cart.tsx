"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// CUSTOM COMPONENTS
import Trash from "icons/Trash";
import CartItem from "../cart-item";
import EmptyCart from "../empty-cart";
import CheckoutForm from "../checkout-form";

export default function CartPageView() {
  const { state, dispatch } = useCart();

  if (state.cart.length === 0) {
    return <EmptyCart />;
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ md: 8, xs: 12 }}>
        {state.cart.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}

        <Box textAlign="end">
          <Button
            disableElevation
            color="error"
            variant="outlined"
            startIcon={<Trash fontSize="small" />}
            onClick={() => dispatch({ type: "CLEAR_CART" })}
          >
            Clear Cart
          </Button>
        </Box>
      </Grid>

      <Grid size={{ md: 4, xs: 12 }}>
        <CheckoutForm />
      </Grid>
    </Grid>
  );
}
