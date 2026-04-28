import CircularProgress from "@mui/material/CircularProgress";
import FlexRowCenter from "components/flex-box/flex-row-center";

export default function Loading() {
  return (
    <FlexRowCenter minHeight="100vh">
      <CircularProgress color="primary" />
    </FlexRowCenter>
  );
}
