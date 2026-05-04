"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
// MUI
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// ORDER HELPERS
import { CHECKOUT_STORAGE_KEY } from "lib/orders/checkout-storage";
import type { CheckoutDetails } from "lib/orders/types";

export default function PaymentForm() {
  const router = useRouter();
  const { state, dispatch } = useCart();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    setError("");

    const checkoutJson = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!checkoutJson) {
      router.push("/checkout");
      return;
    }

    if (!state.cart.length) {
      router.push("/cart");
      return;
    }

    try {
      setIsSubmitting(true);
      const checkout = JSON.parse(checkoutJson) as CheckoutDetails;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout,
          items: state.cart.map((item) => ({ id: item.id, qty: item.qty }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to place order.");
      }

      dispatch({ type: "CLEAR_CART" });
      sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      router.push(`/order-confirmation?orderId=${result.orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to place order.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Fragment>
      <Card
        elevation={0}
        sx={{
          mb: 4,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "grey.50",
          padding: { sm: 3, xs: 2 }
        }}
      >
        <Typography variant="h5" mb={1}>
          Plaćanje pouzećem
        </Typography>

        <Typography color="text.secondary">
          Narudžba će biti kreirana kao manualno plaćanje / pouzećem. Plaćanje karticom i Stripe
          ćemo dodati u narednoj fazi.
        </Typography>

        {error ? <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert> : null}
      </Card>

      {/* BUTTONS SECTION */}
      <Stack direction="row" spacing={3}>
        <Button
          fullWidth
          size="large"
          type="button"
          color="primary"
          href="/checkout"
          variant="outlined"
          LinkComponent={Link}
        >
          Back to checkout
        </Button>

        <Button
          fullWidth
          size="large"
          type="button"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          onClick={handlePlaceOrder}
        >
          Potvrdi narudžbu
        </Button>
      </Stack>
    </Fragment>
  );
}
