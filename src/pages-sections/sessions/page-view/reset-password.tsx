"use client";

import { Fragment } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import { TextField, FormProvider } from "components/form-hook";
import FlexRowCenter from "components/flex-box/flex-row-center";
// LOCAL CUSTOM COMPONENT
import BoxLink from "../components/box-link";

// FORM FIELD VALIDATION SCHEMA
const validationSchema = yup.object().shape({
  email: yup.string().email("invalid email").required("Email is required")
});

export default function ResetPassword() {
  const methods = useForm({
    defaultValues: { email: "" },
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
    <Fragment>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4, textAlign: "center" }}>
        Reset your password
      </Typography>

      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Stack spacing={3}>
          <TextField
            fullWidth
            name="email"
            type="email"
            label="Email"
            size="medium"
            placeholder="exmple@mail.com"
          />

          <Button
            fullWidth
            size="large"
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
          >
            Reset
          </Button>
        </Stack>
      </FormProvider>

      <FlexRowCenter mt={3} justifyContent="center" gap={1}>
        <Typography variant="body1" color="text.secondary">
          Don&apos;t have an account?
        </Typography>

        <BoxLink title="Register" href="/register" />
      </FlexRowCenter>
    </Fragment>
  );
}
