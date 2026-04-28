import Image from "next/image";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENTS
import FlexRowCenter from "components/flex-box/flex-row-center";
// IMPORT IMAGES
import logo from "../../../../public/assets/images/logo2.svg";

export default function LogoWithTitle() {
  return (
    <FlexRowCenter flexDirection="column" gap={2} mb={4}>
      <Image width={90} src={logo} alt="Bazaar Ecommerce Template" />
      <Typography fontWeight={600} variant="h5">
        Welcome To Bazaar
      </Typography>
    </FlexRowCenter>
  );
}
