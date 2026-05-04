"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Resolver, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
import { CHECKOUT_STORAGE_KEY } from "lib/orders/checkout-storage";
// STYLED COMPONENT
import { ButtonWrapper, CardRoot, FormWrapper } from "./styles";

// uncomment these fields below for from validation
/** Hide billing UI for BiH COD checkout; billing fields kept in codebase for reuse. */
const SHOW_BILLING_ADDRESS = false;

const DEFAULT_SHIPPING_COUNTRY = { label: "BiH", value: "BA" } as const;

const validationSchema = yup.object().shape({
  shipping_name: yup.string().required("Name is required"),
  shipping_email: yup.string().email("invalid email").required("Email is required"),
  shipping_contact: yup.string().required("Phone is required"),
  shipping_zip: yup.string().required("Zip is required"),
  shipping_address1: yup.string().required("Address is required"),
  shipping_city: yup.string().required("City is required"),
  delivery_notes: yup.string().optional()
});

type FormValues = yup.InferType<typeof validationSchema>;

/** Keeps outlined labels floated so browser autofill does not clip them. */
const shrinkLabelSlots = {
  slotProps: { inputLabel: { shrink: true } }
} as const;

export default function CheckoutForm() {
  const router = useRouter();

  const initialValues: FormValues = {
    shipping_zip: "",
    shipping_name: "",
    shipping_email: "",
    shipping_contact: "",
    shipping_address1: "",
    shipping_city: "",
    delivery_notes: ""
  };

  const methods = useForm<FormValues>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema) as Resolver<FormValues>
  });

  const { handleSubmit, formState } = methods;
  const { isSubmitting } = formState;

  const handleSubmitForm = handleSubmit((values) => {
    sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        ...values,
        shipping_country: { ...DEFAULT_SHIPPING_COUNTRY },
        same_as_shipping: true
      })
    );
    router.push("/payment");
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <CardRoot elevation={0}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Shipping Address
        </Typography>

        <FormWrapper>
          <TextField
            size="medium"
            fullWidth
            label="Full Name"
            name="shipping_name"
            autoComplete="name"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Phone Number"
            name="shipping_contact"
            autoComplete="tel"
            {...shrinkLabelSlots}
          />
          <TextField
            fullWidth
            type="email"
            size="medium"
            label="Email Address"
            name="shipping_email"
            autoComplete="email"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Address"
            name="shipping_address1"
            autoComplete="street-address"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Grad"
            name="shipping_city"
            autoComplete="address-level2"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Zip Code"
            name="shipping_zip"
            autoComplete="postal-code"
            {...shrinkLabelSlots}
          />
          <TextField
            rows={3}
            multiline
            fullWidth
            size="medium"
            name="delivery_notes"
            label="Dodatne informacije"
            placeholder="Broj stana/ulaza, sprat ili instrukcije kuriru"
            sx={{ gridColumn: { sm: "1 / -1" } }}
            {...shrinkLabelSlots}
          />
        </FormWrapper>
      </CardRoot>

      {SHOW_BILLING_ADDRESS ? (
        <CardRoot elevation={0}>
          <Typography variant="h5">Billing Address</Typography>
          <Typography color="text.secondary">Billing fields are disabled in this build.</Typography>
        </CardRoot>
      ) : null}

      <ButtonWrapper>
        <Button
          size="large"
          fullWidth
          href="/cart"
          color="primary"
          variant="outlined"
          LinkComponent={Link}
        >
          Back to Cart
        </Button>

        <Button
          size="large"
          fullWidth
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
        >
          Proceed to Payment
        </Button>
      </ButtonWrapper>
    </FormProvider>
  );
}
