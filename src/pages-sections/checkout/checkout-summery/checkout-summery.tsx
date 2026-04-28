"use client";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import ListItem from "./list-item";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";

export default function CheckoutSummary() {
  const { state } = useCart();

  const total = state.cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <Card
      elevation={0}
      sx={(theme) => ({
        p: 3,
        backgroundColor: theme.palette.grey[50],
        border: `1px solid ${theme.palette.divider}`
      })}
    >
      <ListItem title="Subtotal" value={total} />
      <ListItem title="Shipping" />
      <ListItem title="Tax" value={0} />
      <ListItem title="Discount" />

      <Divider sx={{ my: 2 }} />

      <Typography variant="h2">{currency(total)}</Typography>

      <Stack direction="row" spacing={2} mt={3}>
        <TextField size="medium" placeholder="Voucher" variant="outlined" fullWidth />

        <Button size="large" variant="outlined" color="primary">
          Apply
        </Button>
      </Stack>
    </Card>
  );
}
