"use client";

import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import MuiTextField from "@mui/material/TextField";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
// CUSTOM DATA MODEL
import User from "models/User.model";

const validationSchema = yup.object().shape({
  firstName: yup.string().required("Ime je obavezno"),
  lastName: yup.string().required("Prezime je obavezno"),
  email: yup.string().email("Neispravna e-mail adresa").required("E-mail je obavezan"),
  contact: yup.string().required("Telefon je obavezan"),
  birthOfDate: yup.date().required("Datum rođenja je obavezan")
});

// ==============================================================
type Props = { user: User };
// ==============================================================

export default function ProfileEditForm({ user }: Props) {
  const initialValues = {
    email: user?.email || "",
    contact: user?.phone || "",
    lastName: user?.name?.lastName || "",
    firstName: user?.name?.firstName || "",
    birthOfDate: user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date()
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    control,
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
          <TextField size="medium" fullWidth name="firstName" label="Ime" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="lastName" label="Prezime" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth name="email" type="email" label="E-mail" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField size="medium" fullWidth label="Telefon" name="contact" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <Controller
            name="birthOfDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <DatePicker
                {...field}
                label="Datum rođenja"
                enableAccessibleFieldDOMStructure={false}
                slots={{ textField: MuiTextField }}
                slotProps={{
                  textField: {
                    sx: { mb: 1 },
                    size: "medium",
                    fullWidth: true,
                    error: Boolean(error),
                    helperText: error?.message || ""
                  }
                }}
              />
            )}
          />
        </Grid>

        <Grid size={12}>
          <Button
            disableElevation
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
