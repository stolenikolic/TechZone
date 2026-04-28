import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// CUSTOM DATA MODEL
import Order from "models/Order.model";

// ==============================================================
type Props = { order: Order };
// ==============================================================

export default function OrderSummery({ order }: Props) {
  return (
    <Grid container spacing={3}>
      <Grid size={{ md: 6, xs: 12 }}>
        <Card elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "grey.100" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Shipping Address
          </Typography>

          <Typography variant="body1">{order.shippingAddress}</Typography>
        </Card>
      </Grid>

      <Grid size={{ md: 6, xs: 12 }}>
        <Card elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "grey.100" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Total Summary
          </Typography>

          <ListItem title="Subtotal:" value={currency(order.totalPrice)} />
          <ListItem title="Shipping fee:" value={currency(0)} />
          <ListItem title="Discount:" value={currency(order.discount)} />

          <Divider sx={{ mb: 1 }} />

          <FlexBetween mb={2}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">{currency(order.totalPrice)}</Typography>
          </FlexBetween>

          <p>Paid by Credit/Debit Card</p>
        </Card>
      </Grid>
    </Grid>
  );
}

function ListItem({ title, value }: { title: string; value: string }) {
  return (
    <FlexBetween mb={1}>
      <Typography color="text.secondary" variant="body1">
        {title}
      </Typography>

      <Typography variant="h6">{value}</Typography>
    </FlexBetween>
  );
}
