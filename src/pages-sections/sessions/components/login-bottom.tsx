import { Fragment } from "react";
import Typography from "@mui/material/Typography";
import { FlexBox, FlexRowCenter } from "components/flex-box";
import BoxLink from "./box-link";

export default function LoginBottom() {
  return (
    <Fragment>
      <FlexRowCenter gap={1} my={3}>
        <Typography variant="body2" color="text.secondary">
          Nemate nalog?
        </Typography>

        <BoxLink title="Registracija" href="/registracija" />
      </FlexRowCenter>

      <FlexBox gap={1} py={2} borderRadius={1} justifyContent="center" bgcolor="grey.50">
        <Typography variant="body2" color="text.secondary">
          Zaboravili ste lozinku?
        </Typography>

        <BoxLink title="Resetujte je" href="/reset-lozinke" />
      </FlexBox>
    </Fragment>
  );
}
