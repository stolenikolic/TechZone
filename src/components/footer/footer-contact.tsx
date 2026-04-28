import { Fragment } from "react";
import Typography from "@mui/material/Typography";
import { Heading } from "./styles";

// ==============================================================
interface Props {
  email: string;
  phone: string;
  address: string;
}
// ==============================================================

export function FooterContact({ email, phone, address }: Props) {
  return (
    <Fragment>
      <Heading>Contact Us</Heading>

      <Typography variant="body1" sx={{ py: 0.6 }}>
        {address}
      </Typography>

      <Typography variant="body1" sx={{ py: 0.6 }}>
        Email: {email}
      </Typography>

      <Typography variant="body1" sx={{ py: 0.6, mb: 2 }}>
        Phone: {phone}
      </Typography>
    </Fragment>
  );
}
