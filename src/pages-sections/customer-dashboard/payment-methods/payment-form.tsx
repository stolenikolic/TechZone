"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
// CUSTOM DATA MODEL
import Payment from "models/Payment.model";

const validationSchema = yup.object().shape({
  name: yup.string().required("Ime je obavezno"),
  cvc: yup.string().required("CVC je obavezan"),
  card_no: yup.string().required("Broj kartice je obavezan"),
  exp: yup.string().required("Datum isteka je obavezan")
});

// ==============================================================
type Props = { payment: Payment };
// ==============================================================

export default function PaymentForm({ payment }: Props) {
  const initialValues = {
    exp: payment?.exp || "",
    cvc: payment?.cvc || "",
    card_no: payment?.card_no || "",
    name: payment?.payment_method || ""
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="card_no" label="Broj kartice" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="name" label="Ime na kartici" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="exp" label="Datum isteka" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="cvc" label="CVC" />
        </Grid>

        <Grid size={12}>
          <Button
            size="large"
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
          >
            Sačuvaj izmjene
          </Button>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
