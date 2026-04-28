import Link from "next/link";
// MUI
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
// GLOBAL CUSTOM COMPONENTS
import HoverBox from "components/HoverBox";
import { FlexBetween, FlexBox } from "components/flex-box";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ===========================================================
type Props = { product: Product };
// ===========================================================

export default function LongProductCard({ product }: Props) {
  if (!product) return null;

  const { slug, title, price, thumbnail, rating, discount } = product;

  return (
    <div>
      <Link href={`/products/${slug}`}>
        <HoverBox sx={{ position: "relative" }}>
          <Box component="img" src={thumbnail} width="100%" height="auto" alt={title} mx="auto" />
        </HoverBox>
      </Link>

      <FlexBetween>
        <Box mt={2}>
          <Typography noWrap variant="h4" sx={{ fontSize: 14, mb: 0.5 }}>
            {title}
          </Typography>

          <Rating size="small" value={rating} color="warn" readOnly />

          <FlexBox alignItems="center" gap={1}>
            <Typography variant="h6" color="primary">
              {calculateDiscount(price, discount)}
            </Typography>

            {discount ? (
              <Box component="del" color="grey.600" fontWeight={600}>
                {formatPrice(price)}
              </Box>
            ) : null}
          </FlexBox>
        </Box>

        <IconButton disableRipple disableFocusRipple>
          <FavoriteBorder fontSize="small" color="secondary" sx={{ opacity: 0.5 }} />
        </IconButton>
      </FlexBetween>
    </div>
  );
}
