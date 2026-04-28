import { useForm } from "react-hook-form";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import DropZone from "components/DropZone";
import { FormProvider, TextField } from "components/form-hook";
// LOCAL CUSTOM COMPONENTS
import ColumnTwoLinks from "./column-two-links";
import ColumnThreeLinks from "./column-three-links";

const initialValues = {
  footer_description: "",

  column_two_links: [],
  column_two_heading: "",

  column_three_links: [],
  column_three_heading: "",

  column_four_heading: "",
  column_four_description: ""
};

export default function FooterForm() {
  const methods = useForm({ defaultValues: initialValues });

  const {
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    console.log(values);
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <DropZone onChange={(files) => console.log(files)} />
        </Grid>

        <Grid size={12}>
          <TextField
            rows={4}
            multiline
            fullWidth
            color="info"
            size="medium"
            name="footer_description"
            label="Footer Description"
          />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <ColumnTwoLinks />

        <Grid size={12}>
          <Divider />
        </Grid>

        <ColumnThreeLinks />

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Four Column Content
          </Typography>

          <TextField
            fullWidth
            color="info"
            size="medium"
            label="Heading"
            name="column_four_heading"
            sx={{ mb: 3 }}
          />

          <TextField
            rows={4}
            multiline
            fullWidth
            color="info"
            size="medium"
            label="Column Content"
            name="column_four_description"
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
