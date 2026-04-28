"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import { Autocomplete, FormProvider, TextField } from "components/form-hook";
// DATA
import countryList from "data/countryList";
// LOCAL CUSTOM COMPONENT
import PageWrapper from "../../page-wrapper";
import CoverPicSection from "../cover-pic-section";

const validationSchema = yup.object().shape({
  city: yup.string().required("City is required"),
  country: yup.mixed().required("Country is required"),
  contact: yup.string().required("Contact is required"),
  last_name: yup.string().required("Last name is required"),
  first_name: yup.string().required("First name is required"),
  email: yup.string().email("Invalid Email").required("Email is required")
});

export default function AccountSettingsPageView() {
  const initialValues = {
    city: "",
    email: "",
    contact: "",
    last_name: "",
    first_name: "",
    country: { label: "", value: "" }
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
  });

  return (
    <PageWrapper title="Account Setting">
      <Card className="p-2">
        {/* COVER SECTION */}
        <CoverPicSection />

        {/* FORM SECTION */}
        <FormProvider methods={methods} onSubmit={handleSubmitForm}>
          <Grid container spacing={3}>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField fullWidth size="medium" name="first_name" label="First Name" />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField fullWidth size="medium" name="last_name" label="Last Name" />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField fullWidth name="email" type="email" label="Email" size="medium" />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField fullWidth type="tel" size="medium" label="Phone" name="contact" />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <Autocomplete
                disablePortal
                size="medium"
                name="country"
                label="Country"
                placeholder="Select Country"
                options={countryList}
                getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
              />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField fullWidth name="city" label="City" color="info" size="medium" />
            </Grid>

            <Grid size={12}>
              <Button type="submit" variant="contained" color="info" loading={isSubmitting}>
                Save Changes
              </Button>
            </Grid>
          </Grid>
        </FormProvider>
      </Card>
    </PageWrapper>
  );
}
