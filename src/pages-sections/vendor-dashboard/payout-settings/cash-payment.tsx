import { Fragment } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export default function CashPayment() {
  return (
    <Fragment>
      <Typography variant="h6" sx={{ mb: 4 }}>
        Cash Payment
      </Typography>

      <TextField
        fullWidth
        color="info"
        size="medium"
        name="amount"
        label="Amount"
        defaultValue="$250"
        sx={{ mb: 3 }}
      />

      <Button type="submit" color="info" variant="contained">
        Save Changes
      </Button>
    </Fragment>
  );
}
