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
import Address from "models/Address.model";

const validationSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  address: yup.string().required("Address is required"),
  contact: yup.string().required("Contact is required")
});

// =============================================================
type Props = { address: Address };
// =============================================================

export default function AddressForm({ address }: Props) {
  const initialValues = {
    name: address.title || "",
    contact: address.phone || "",
    address: address.street || ""
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
          <TextField fullWidth size="medium" name="name" label="Name" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField fullWidth size="medium" name="address" label="Address Line" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField fullWidth size="medium" label="Phone" name="contact" />
        </Grid>

        <Grid size={12}>
          <Button
            size="large"
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
          >
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
