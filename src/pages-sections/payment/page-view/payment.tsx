"use client";

import Grid from "@mui/material/Grid";
// LOCAL CUSTOM COMPONENTS
import PaymentForm from "../payment-form";
import PaymentSummary from "../payment-summery";

export default function PaymentPageView() {
  return (
    <Grid container flexWrap="wrap-reverse" spacing={3}>
      <Grid size={{ md: 8, xs: 12 }}>
        <PaymentForm />
      </Grid>

      <Grid size={{ md: 4, xs: 12 }}>
        <PaymentSummary />
      </Grid>
    </Grid>
  );
}
