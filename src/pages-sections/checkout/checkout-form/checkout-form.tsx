"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import clsx from "clsx";
// MUI
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField, Autocomplete, Checkbox } from "components/form-hook";
// DUMMY CUSTOM DATA
import countryList from "data/countryList";
// STYLED COMPONENT
import { ButtonWrapper, CardRoot, FormWrapper } from "./styles";

// uncomment these fields below for from validation
const validationSchema = yup.object().shape({
  shipping_name: yup.string().required("Name is required"),
  shipping_email: yup.string().email("invalid email").required("Email is required"),
  shipping_contact: yup.string().required("Phone is required"),
  shipping_zip: yup.string().required("Zip is required"),
  shipping_country: yup.mixed().required("Country is required"),
  shipping_address1: yup.string().required("Address is required"),
  same_as_shipping: yup.boolean().optional(),
  billing_name: yup.string().optional(),
  billing_email: yup.string().optional(),
  billing_contact: yup.string().optional(),
  billing_zip: yup.string().optional(),
  billing_country: yup.object().optional(),
  billing_address1: yup.string().optional()
});

type FormValues = yup.InferType<typeof validationSchema>;

export default function CheckoutForm() {
  const router = useRouter();

  const initialValues: FormValues = {
    shipping_zip: "",
    shipping_name: "",
    shipping_email: "",
    shipping_contact: "",
    shipping_address1: "",
    shipping_country: { label: "United States", value: "US" },
    same_as_shipping: false,
    billing_zip: "",
    billing_name: "",
    billing_email: "",
    billing_contact: "",
    billing_address1: "",
    billing_country: { label: "United States", value: "US" }
  };

  const methods = useForm<FormValues>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema) as Resolver<FormValues>
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const sameAsShipping = useWatch({
    control,
    name: "same_as_shipping"
  });

  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
    router.push("/payment");
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <CardRoot elevation={0}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Shipping Address
        </Typography>

        <FormWrapper>
          <TextField size="medium" fullWidth label="Full Name" name="shipping_name" />
          <TextField size="medium" fullWidth label="Phone Number" name="shipping_contact" />
          <TextField
            fullWidth
            type="email"
            size="medium"
            label="Email Address"
            name="shipping_email"
          />
          <TextField size="medium" fullWidth label="Company" name="shipping_company" />
          <TextField size="medium" fullWidth label="Address 1" name="shipping_address1" />
          <TextField size="medium" fullWidth label="Address 2" name="shipping_address2" />
          <Autocomplete
            fullWidth
            size="medium"
            label="Country"
            options={countryList}
            name="shipping_country"
            placeholder="Select Country"
            getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
          />
          <TextField size="medium" fullWidth label="Zip Code" name="shipping_zip" />
        </FormWrapper>
      </CardRoot>

      <CardRoot elevation={0}>
        <Typography variant="h5">Billing Address</Typography>

        <Checkbox
          size="small"
          color="secondary"
          name="same_as_shipping"
          label="Same as shipping address"
          className={clsx({ "mb-1": !sameAsShipping })}
        />

        {!sameAsShipping && (
          <FormWrapper>
            <TextField size="medium" fullWidth label="Full Name" name="billing_name" />
            <TextField size="medium" fullWidth label="Phone Number" name="billing_contact" />
            <TextField
              size="medium"
              fullWidth
              type="email"
              name="billing_email"
              label="Email Address"
            />
            <TextField size="medium" fullWidth label="Company" name="billing_company" />
            <TextField size="medium" fullWidth label="Address 1" name="billing_address1" />
            <TextField size="medium" fullWidth label="Address 2" name="billing_address2" />
            <Autocomplete
              size="medium"
              fullWidth
              label="Country"
              options={countryList}
              name="billing_country"
              placeholder="Select Country"
              getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
            />
            <TextField size="medium" fullWidth label="Zip Code" name="billing_zip" />
          </FormWrapper>
        )}
      </CardRoot>

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
