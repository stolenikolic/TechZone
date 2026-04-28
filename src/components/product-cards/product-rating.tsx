import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { BoxProps } from "@mui/material/Box";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

// ==============================================================
interface Props extends BoxProps {
  rating: number;
  showRating?: boolean;
}
// ==============================================================

export default function ProductRating({ showRating = true, rating = 0, ...props }: Props) {
  if (showRating) {
    return (
      <FlexBox gap={1} alignItems="center" {...props}>
        <Rating size="small" value={rating} color="warn" readOnly />
        <Typography variant="body1" sx={{ fontSize: 12, color: "grey.600", fontWeight: 500 }}>
          ({rating})
        </Typography>
      </FlexBox>
    );
  }

  return null;
}
