import Grid from "@mui/material/Grid";
// LOCAL CUSTOM COMPONENTS
import CheckoutForm from "../checkout-form";
import CheckoutSummary from "../checkout-summery";

export default function CheckoutPageView() {
  return (
    <Grid container flexWrap="wrap-reverse" spacing={3}>
      <Grid size={{ md: 8, xs: 12 }}>
        <CheckoutForm />
      </Grid>

      <Grid size={{ md: 4, xs: 12 }}>
        <CheckoutSummary />
      </Grid>
    </Grid>
  );
}
