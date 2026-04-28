import { Fragment } from "react";
import { useForm, useFieldArray } from "react-hook-form";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Delete from "@mui/icons-material/Delete";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import { FormProvider, TextField } from "components/form-hook";

export default function TopbarForm() {
  const initialValues = {
    phone: "12345678910",
    email: "ui.lib.drive@gmail.com",
    links: [
      { _id: 1, name: "Theme FAQ's", link: "https://www.themefaqs.com" },
      { _id: 2, name: "Help", link: "https://www.help.com" }
    ]
  };

  const methods = useForm({ defaultValues: initialValues });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: "links" });

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    console.log(values);
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={2}>
        <Grid size={12}>
          <Typography variant="h4">Top Bar Left Content</Typography>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            name="phone"
            color="info"
            size="medium"
            label="Phone"
            placeholder="0000000000"
          />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField
            fullWidth
            color="info"
            name="email"
            size="medium"
            label="Email"
            placeholder="email@example.com"
          />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Fragment>
          <Grid size={12}>
            <FlexBox alignItems="center" justifyContent="space-between">
              <Typography variant="h4">Top Bar Right</Typography>

              <Button
                color="info"
                variant="contained"
                onClick={() => append({ _id: Date.now(), name: "", link: "" })}
              >
                Add Item
              </Button>
            </FlexBox>
          </Grid>

          {fields.map((item, index) => (
            <Grid container spacing={2} size={12} key={item.id}>
              <Grid size={5}>
                <TextField
                  fullWidth
                  color="info"
                  size="medium"
                  label="Name"
                  name={`links.${index}.name`}
                />
              </Grid>

              <Grid size={5}>
                <TextField
                  fullWidth
                  color="info"
                  size="medium"
                  label="Link"
                  name={`links.${index}.link`}
                />
              </Grid>

              <Grid size={2}>
                <IconButton onClick={() => remove(index)}>
                  <Delete />
                </IconButton>
              </Grid>
            </Grid>
          ))}
        </Fragment>

        <Grid size={12}>
          <Button loading={isSubmitting} type="submit" color="info" variant="contained">
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
