import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENT
import DropZone from "components/DropZone";
import { FormProvider, TextField } from "components/form-hook";

const validationSchema = yup.object().shape({
  site_name: yup.string().required("site name is required"),
  site_description: yup.string().required("site description is required"),
  site_banner_text: yup.string().required("site banner text required")
});

export default function GeneralForm() {
  const initialValues = {
    site_name: "",
    site_description: "",
    site_banner_text: ""
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
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <DropZone onChange={(files) => console.log(files)} />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField fullWidth color="info" size="medium" name="site_name" label="Site Name" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            size="medium"
            name="site_description"
            label="Site Description"
          />
        </Grid>

        <Grid size={12}>
          <TextField
            rows={6}
            fullWidth
            multiline
            color="info"
            size="medium"
            name="site_banner_text"
            label="Site Banner Text"
          />
        </Grid>

        <Grid size={12}>
          <DropZone
            onChange={(files) => {
              console.log(files);
            }}
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
