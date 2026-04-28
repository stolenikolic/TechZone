import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM ICON
import Verify from "icons/Verify";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// CUSTOM DATA MODEL
import { PackageItem } from "./types";
import IconComponent from "components/IconComponent";

// STYLED COMPONENTS
const Wrapper = styled(Card)({
  display: "flex",
  padding: "3rem 2rem",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center"
});

const PackageHeading = styled("h1")(({ theme }) => ({
  fontSize: 48,
  fontWeight: 600,
  ":after": {
    fontSize: 16,
    fontWeight: 600,
    content: "'/month'",
    verticalAlign: "baseline",
    color: theme.palette.grey[600]
  }
}));

// ===================================================
type Props = { listItem: PackageItem };
// ===================================================

export default function SellerPackageCard({ listItem }: Props) {
  const { packageName, price, icon, features = [] } = listItem;

  return (
    <Wrapper>
      {icon && <IconComponent icon={icon} sx={{ fontSize: 100 }} />}

      <Typography variant="h4" sx={{ mt: 3 }}>
        {packageName} Package
      </Typography>

      <PackageHeading>{currency(price, 0)}</PackageHeading>

      <Box mt={1} mb={2}>
        {features.map((item, index) => (
          <FlexBox gap={1} my={2} alignItems="center" key={index}>
            <Verify fontSize="small" />
            <Typography variant="h6">{item}</Typography>
          </FlexBox>
        ))}
      </Box>

      <FlexBox alignItems="center" gap={2} width={200}>
        <Button fullWidth color="secondary" variant="outlined">
          Edit
        </Button>

        <Button fullWidth color="error" variant="outlined">
          Delete
        </Button>
      </FlexBox>
    </Wrapper>
  );
}
