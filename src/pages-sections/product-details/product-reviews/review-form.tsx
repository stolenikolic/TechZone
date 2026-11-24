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
  rating: yup.number().required("Ocjena je obavezna."),
  comment: yup.string().required("Komentar je obavezan.")
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
          Vaša ocjena <span>*</span>
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
              emptyLabelText="Bez ocjene"
              getLabelText={(value) =>
                value === 1 ? "1 zvjezdica" : value >= 2 && value <= 4 ? `${value} zvjezdice` : `${value} zvjezdica`
              }
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
          Vaša recenzija <span>*</span>
        </Typography>

        <TextField
          rows={8}
          multiline
          fullWidth
          name="comment"
          variant="outlined"
          placeholder="Napišite recenziju ovdje..."
        />
      </Box>

      <Button loading={isSubmitting} variant="contained" color="primary" type="submit">
        Pošalji
      </Button>
    </FormProvider>
  );
}
