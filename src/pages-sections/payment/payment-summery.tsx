import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import PaymentItem from "./payment-item";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import { STANDARD_SHIPPING_FEE_KM } from "lib/orders/constants";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";

export default function PaymentSummary() {
  const { state } = useCart();
  const subtotal = state.cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const shipping = STANDARD_SHIPPING_FEE_KM;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "grey.50",
        padding: { sm: 3, xs: 2 }
      }}
    >
      <PaymentItem title="Subtotal:" amount={subtotal} />
      <PaymentItem title="Shipping:" amount={shipping} />
      <PaymentItem title="Tax:" amount={0} />
      <PaymentItem title="Discount:" amount={0} />

      <Divider sx={{ my: 2 }} />

      <Typography variant="h4" textAlign="right">
        {currency(total)}
      </Typography>
    </Card>
  );
}
