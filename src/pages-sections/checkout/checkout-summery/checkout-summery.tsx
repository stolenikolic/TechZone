"use client";

import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import ListItem from "./list-item";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import { STANDARD_SHIPPING_FEE_KM } from "lib/orders/constants";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";

export default function CheckoutSummary() {
  const { state } = useCart();

  const subtotal = state.cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const shipping = STANDARD_SHIPPING_FEE_KM;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  return (
    <Card
      elevation={0}
      sx={(theme) => ({
        p: 3,
        backgroundColor: theme.palette.grey[50],
        border: `1px solid ${theme.palette.divider}`
      })}
    >
      <ListItem title="Subtotal" value={subtotal} />
      <ListItem title="Shipping" value={shipping} />
      <ListItem title="Tax" value={0} />
      <ListItem title="Discount" value={0} />

      <Divider sx={{ my: 2 }} />

      <Typography variant="h2">{currency(total)}</Typography>
    </Card>
  );
}
