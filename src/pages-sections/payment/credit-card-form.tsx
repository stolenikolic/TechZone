import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

export default function CreditCardForm() {
  // const INITIAL_VALUES = {
  //   card_no: "",
  //   name: "",
  //   exp_date: "",
  //   cvc: "",
  //   shipping_zip: "",
  //   shipping_country: "",
  //   shipping_address1: "",
  //   shipping_address2: "",

  //   billing_name: "",
  //   billing_email: "",
  //   billing_contact: "",
  //   billing_company: "",
  //   billing_zip: "",
  //   billing_country: "",
  //   billing_address1: "",
  //   billing_address2: ""
  // };

  // const VALIDATION_SCHEMA = yup.object().shape({
  //   card_no: yup.string().required("required"),
  //   name: yup.string().required("required"),
  //   exp_date: yup.string().required("required"),
  //   cvc: yup.string().required("required")
  // });

  return (
    <form>
      <Grid container spacing={2} mt={1}>
        <Grid size={{ sm: 6, xs: 12 }}>
          <TextField fullWidth name="card_no" label="Card Number" />
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <TextField fullWidth name="exp_date" label="Exp Date" placeholder="MM/YY" />
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <TextField fullWidth name="name" label="Name on Card" />
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <TextField fullWidth name="name" label="Name on Card" />
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <Button variant="outlined" color="primary">
            Submit
          </Button>
        </Grid>
      </Grid>
    </form>
  );
}
