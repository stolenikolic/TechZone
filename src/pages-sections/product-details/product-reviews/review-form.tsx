"use client";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
// STYLED COMPONENTS
import { RatingGroup } from "./styles";

const validationSchema = yup.object().shape({
  rating: yup.number().required("Rating is required!"),
  comment: yup.string().required("Comment is required!")
});

export default function ReviewForm() {
  const initialValues = {
    rating: 0,
    comment: "",
    date: new Date().toISOString()
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = methods;

  // FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit((values) => {
    alert(JSON.stringify(values, null, 2));
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <RatingGroup>
        <Typography
          variant="h6"
          sx={{ color: "grey.700", span: { color: "error.main" } }}
          color="grey.700"
        >
          Your Rating <span>*</span>
        </Typography>

        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <Rating
              color="warn"
              size="medium"
              name={field.name}
              value={field.value}
              onChange={(_, value) => field.onChange(value)}
            />
          )}
        />
      </RatingGroup>

      <Box mb={3}>
        <Typography
          variant="h6"
          sx={{ mb: 1, color: "grey.700", span: { color: "error.main" } }}
          color="grey.700"
        >
          Your Review <span>*</span>
        </Typography>

        <TextField
          rows={8}
          multiline
          fullWidth
          name="comment"
          variant="outlined"
          placeholder="Write a review here..."
        />
      </Box>

      <Button loading={isSubmitting} variant="contained" color="primary" type="submit">
        Submit
      </Button>
    </FormProvider>
  );
}
