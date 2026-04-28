"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";

const initialValues = { message: "" };

const validationSchema = yup.object().shape({
  message: yup.string().required("Message is required")
});

export default function MessageForm() {
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
      <TextField
        rows={8}
        fullWidth
        multiline
        name="message"
        placeholder="Write your message here..."
        sx={{ mb: 3 }}
      />

      <Button size="large" loading={isSubmitting} type="submit" color="primary" variant="contained">
        Post message
      </Button>
    </FormProvider>
  );
}
