import Image from "next/image";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENTS
import FlexRowCenter from "components/flex-box/flex-row-center";
// IMPORT IMAGES
import logo from "../../../../public/assets/images/logo.svg";

export default function LogoWithTitle() {
  return (
    <FlexRowCenter flexDirection="column" gap={2} mb={4}>
      <Image width={200} height={69} src={logo} alt="Tech Zone" style={{ width: "auto", height: "auto", maxWidth: 200 }} />
      <Typography fontWeight={600} variant="h5">
        Dobrodošli u Tech Zone
      </Typography>
    </FlexRowCenter>
  );
}
