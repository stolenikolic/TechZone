import Typography from "@mui/material/Typography";
import FlexRowCenter from "components/flex-box/flex-row-center";
import BoxLink from "./box-link";

export default function RegisterBottom() {
  return (
    <FlexRowCenter gap={1} mt={3}>
      <Typography variant="body2" color="text.secondary">
        Already have an account?
      </Typography>

      <BoxLink title="Login" href="/login" />
    </FlexRowCenter>
  );
}
