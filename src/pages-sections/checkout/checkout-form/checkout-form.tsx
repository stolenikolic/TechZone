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
  shipping_name: yup.string().required("Ime je obavezno"),
  shipping_email: yup.string().email("Neispravna e-mail adresa").required("E-mail je obavezan"),
  shipping_contact: yup.string().required("Broj telefona je obavezan"),
  shipping_zip: yup.string().required("Poštanski broj je obavezan"),
  shipping_address1: yup.string().required("Adresa je obavezna"),
  shipping_city: yup.string().required("Grad je obavezan"),
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
    router.push("/placanje");
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <CardRoot elevation={0}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Adresa za dostavu
        </Typography>

        <FormWrapper>
          <TextField
            size="medium"
            fullWidth
            label="Ime i prezime"
            name="shipping_name"
            autoComplete="name"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Broj telefona"
            name="shipping_contact"
            autoComplete="tel"
            {...shrinkLabelSlots}
          />
          <TextField
            fullWidth
            type="email"
            size="medium"
            label="E-mail adresa"
            name="shipping_email"
            autoComplete="email"
            {...shrinkLabelSlots}
          />
          <TextField
            size="medium"
            fullWidth
            label="Adresa"
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
            label="Poštanski broj"
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
          <Typography variant="h5">Adresa za naplatu</Typography>
          <Typography color="text.secondary">Polja za naplatu su isključena u ovoj verziji.</Typography>
        </CardRoot>
      ) : null}

      <ButtonWrapper>
        <Button
          size="large"
          fullWidth
          href="/korpa"
          color="primary"
          variant="outlined"
          LinkComponent={Link}
        >
          Nazad u korpu
        </Button>

        <Button
          size="large"
          fullWidth
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
        >
          Nastavi na plaćanje
        </Button>
      </ButtonWrapper>
    </FormProvider>
  );
}
