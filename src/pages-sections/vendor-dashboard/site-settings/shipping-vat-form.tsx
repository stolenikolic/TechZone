import { useForm } from "react-hook-form";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";

export default function ShippingVatForm() {
  const methods = useForm({
    defaultValues: {
      vat: 2,
      shipping: 10
    }
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
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Typography variant="h4">Shipping and Vat</Typography>
        </Grid>

        <Grid size={{ md: 7, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            type="number"
            name="shipping"
            label="Shipping Charge"
          />
        </Grid>

        <Grid size={{ md: 7, xs: 12 }}>
          <TextField
            fullWidth
            name="vat"
            color="info"
            size="medium"
            type="number"
            label="VAT (%)"
          />
        </Grid>

        <Grid size={12}>
          <Button loading={isSubmitting} type="submit" color="info" variant="contained">
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
