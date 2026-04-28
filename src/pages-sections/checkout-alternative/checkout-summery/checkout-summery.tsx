"use client";

import { useMemo } from "react";
// MUI
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency, formatPrice } from "lib";

const CARD_STYLES = {
  padding: 3,
  border: "1px solid",
  borderColor: "grey.100"
} as const;

export default function CheckoutSummary() {
  const { state } = useCart();

  const { subtotal, tax, total, discount, shipping } = useMemo(() => {
    if (!state?.cart?.length) {
      return {
        subtotal: 0,
        tax: 0,
        total: 0,
        discount: 0,
        shipping: 0
      };
    }

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = 40;
    const shipping = 0;
    const discount = 0;

    const total = subtotal + tax + shipping - discount;
    return { subtotal, tax, total, discount, shipping };
  }, [state?.cart]);

  if (!state || !state.cart.length) return null;

  return (
    <Card elevation={0} sx={CARD_STYLES}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Your order
      </Typography>

      {state.cart.map((item) => (
        <FlexBetween mb={1.5} key={item.id}>
          <Typography variant="body1">
            <strong>{item.qty}</strong> x {item.title}
          </Typography>

          <Typography variant="body1">{formatPrice(item.price)}</Typography>
        </FlexBetween>
      ))}

      <Divider sx={{ my: 3 }} />

      <ListItem title="Subtotal" value={subtotal} />
      <ListItem title="Shipping" value={shipping} />
      <ListItem title="Tax" value={tax} />
      <ListItem title="Discount" value={discount} mb={3} />

      <Divider sx={{ mb: 1 }} />

      <ListItem title="Total" value={total} />
    </Card>
  );
}

interface ListItemProps {
  mb?: number;
  title: string;
  value?: number;
}

function ListItem({ title, mb = 0.5, value = 0 }: ListItemProps) {
  return (
    <FlexBetween mb={mb}>
      <Typography variant="body1" color="text.secondary">
        {title}:
      </Typography>

      <Typography variant="body1" fontWeight={600}>
        {value ? currency(value) : "-"}
      </Typography>
    </FlexBetween>
  );
}
