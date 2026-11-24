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

function paymentLabel(method: string | undefined) {
  const value = (method ?? "").trim().toLowerCase();
  if (value === "cash on delivery" || value === "cod") return "Plaćanje pouzećem";
  if (value.includes("card") || value.includes("credit") || value.includes("debit")) {
    return "Plaćeno kreditnom ili debitnom karticom";
  }
  return method || "Plaćeno kreditnom ili debitnom karticom";
}

export default function OrderSummery({ order }: Props) {
  return (
    <Grid container spacing={3}>
      <Grid size={{ md: 6, xs: 12 }}>
        <Card elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "grey.100" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Adresa za dostavu
          </Typography>

          <Typography variant="body1">{order.shippingAddress}</Typography>
        </Card>
      </Grid>

      <Grid size={{ md: 6, xs: 12 }}>
        <Card elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "grey.100" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Pregled iznosa
          </Typography>

          <ListItem title="Međuzbir:" value={currency(order.subtotal ?? order.totalPrice)} />
          <ListItem title="Dostava:" value={currency(order.shippingTotal ?? 0)} />
          <ListItem title="Popust:" value={currency(order.discount)} />

          <Divider sx={{ mb: 1 }} />

          <FlexBetween mb={2}>
            <Typography variant="h6">Ukupno</Typography>
            <Typography variant="h6">{currency(order.totalPrice)}</Typography>
          </FlexBetween>

          <p>{paymentLabel(order.paymentMethod)}</p>
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
