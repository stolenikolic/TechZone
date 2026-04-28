import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";

// ==============================================================
type Props = { price: number; discount: number };
// ==============================================================

export default function ProductPrice({ discount, price }: Props) {
  return (
    <FlexBox alignItems="center" gap={1} mt={0.5}>
      <Typography fontWeight={600} sx={{ color: "price.main" }}>
        {calculateDiscount(price, discount)}
      </Typography>

      {discount > 0 && (
        <Box component="del" fontSize={12} fontWeight={500} color="grey.400">
          {formatPrice(price)}
        </Box>
      )}
    </FlexBox>
  );
}
