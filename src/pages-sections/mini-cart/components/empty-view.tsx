import Link from "next/link";
import Image from "next/image";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

export default function EmptyCartView() {
  return (
    <FlexBox
      alignItems="center"
      flexDirection="column"
      justifyContent="center"
      height="calc(100% - 74px)"
    >
      <Image width={90} height={100} alt="banner" src="/assets/images/logos/shopping-bag.svg" />

      <Typography
        variant="body1"
        fontSize={16}
        color="text.secondary"
        sx={{
          my: 2,
          maxWidth: 200,
          textAlign: "center"
        }}
      >
        No products in the cart
      </Typography>

      <Link href="/products/search">
        <Button variant="contained" color="primary">
          Continue Shopping
        </Button>
      </Link>
    </FlexBox>
  );
}
