import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";

const validationSchema = yup.object().shape({
  shopName: yup.string().required("Shop Name is required!"),
  shopPhone: yup.string().required("Shop Phone is required!"),
  category: yup.string().required("Category is required!"),
  description: yup.string().required("Description is required!"),
  shopAddress: yup.string().required("Shop Address is required!"),
  order: yup.number().required("Orders is required!")
});

export default function SettingsForm() {
  const initialValues = {
    order: 10,
    category: "fashion",
    shopName: "The Icon Style",
    shopPhone: "+123 4567 8910",
    shopAddress: "4990 Hide A Way Road Santa Clara, CA 95050.",
    description: `There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomized words which don't look even slightly believable.`
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
      <Stack spacing={3} mb={3}>
        <TextField color="info" size="medium" name="shopName" label="Shop Name *" />
        <TextField color="info" size="medium" name="shopPhone" label="Shop Phone" />
        <TextField
          select
          fullWidth
          color="info"
          size="medium"
          name="category"
          placeholder="Category"
          label="Select Category"
        >
          <MenuItem value="electronics">Electronics</MenuItem>
          <MenuItem value="fashion">Fashion</MenuItem>
        </TextField>
        <TextField
          rows={6}
          multiline
          fullWidth
          color="info"
          size="medium"
          name="description"
          label="Description (optional)"
        />

        <TextField color="info" size="medium" name="shopAddress" label="Shop Address" />
        <TextField name="order" color="info" size="medium" type="number" label="Minimum Order *" />
      </Stack>

      <Button loading={isSubmitting} type="submit" color="info" variant="contained">
        Save Changes
      </Button>
    </FormProvider>
  );
}
