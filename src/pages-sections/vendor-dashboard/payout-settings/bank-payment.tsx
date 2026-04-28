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
  routingNo: yup.string().required("Routing No is required!"),
  amount: yup.string().required("Amount is required!"),
  accountNo: yup.string().required("Account No is required!"),
  accountHolderName: yup.string().required("Acc. Holder Name is required!")
});

export default function BankPayment() {
  const initialValues = {
    amount: "$250",
    routingNo: "255",
    accountNo: "12345678910",
    accountHolderName: "Gage Paquette"
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
        Bank Payment
      </Typography>

      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Stack spacing={3} mb={3}>
          <TextField color="info" size="medium" name="amount" label="Amount" />
          <TextField
            color="info"
            size="medium"
            name="accountHolderName"
            label="Account Holder Name"
          />
          <TextField color="info" size="medium" name="accountNo" label="Account No" />
          <TextField color="info" size="medium" name="routingNo" label="Routing No" />
        </Stack>

        <Button loading={isSubmitting} type="submit" color="info" variant="contained">
          Save Changes
        </Button>
      </FormProvider>
    </Fragment>
  );
}
