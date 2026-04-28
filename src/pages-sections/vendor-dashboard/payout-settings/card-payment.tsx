import { Fragment } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// MUI
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";

const validationSchema = yup.object().shape({
  cardCvc: yup.string().required("Card CVC is required!"),
  amount: yup.string().required("Amount is required!"),
  cardNo: yup.string().required("Card No is required!"),
  cardHolderName: yup.string().required("Card Holder Name is required!")
});

export default function CardPayment() {
  const initialValues = {
    amount: "$250",
    cardCvc: "255",
    cardNo: "12345678910",
    cardHolderName: "Gage Paquette"
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
    <Fragment>
      <Typography variant="h6" sx={{ mb: 4 }}>
        Card Payment
      </Typography>

      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Stack spacing={3} mb={3}>
          <TextField color="info" size="medium" name="amount" label="Amount" />
          <TextField color="info" size="medium" name="cardHolderName" label="Card Holder Name" />
          <TextField color="info" size="medium" name="cardNo" label="Card No" />
          <TextField color="info" size="medium" name="cardCvc" label="Card CVC" />
        </Stack>

        <Button loading={isSubmitting} type="submit" color="info" variant="contained">
          Save Changes
        </Button>
      </FormProvider>
    </Fragment>
  );
}
