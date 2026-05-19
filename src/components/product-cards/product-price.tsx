import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";

// ==============================================================
type Props = { price: number; discount: number; originalPrice?: number };
// ==============================================================

export default function ProductPrice({ discount, price, originalPrice }: Props) {
  const showOriginal = originalPrice != null && originalPrice > price;
  const showDiscount = !showOriginal && discount > 0;

  return (
    <FlexBox alignItems="center" gap={1} mt={0.5} flexWrap="wrap">
      <Typography fontWeight={600} sx={{ color: "price.main" }}>
        {showDiscount ? calculateDiscount(price, discount) : formatPrice(price)}
      </Typography>

      {showOriginal ? (
        <Box component="del" fontSize={12} fontWeight={500} sx={{ color: "primary.main" }}>
          {formatPrice(originalPrice)}
        </Box>
      ) : null}

      {showDiscount ? (
        <Box component="del" fontSize={12} fontWeight={500} color="grey.400">
          {formatPrice(price)}
        </Box>
      ) : null}
    </FlexBox>
  );
}
