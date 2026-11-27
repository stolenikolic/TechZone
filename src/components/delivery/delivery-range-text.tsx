import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import type { DeliveryBandTone } from "lib/product-offers/delivery-band";

const TONE_COLOR: Record<DeliveryBandTone, string> = {
  fast: "success.main",
  standard: "warning.main",
  slow: "grey.500"
};

type Props = {
  tone: DeliveryBandTone;
  rangeLabel: string;
  /** Words before the range, e.g. "Isporuka za" or "Isporuka narudžbe:". */
  lead: string;
  variant?: TypographyProps["variant"];
  fontSize?: number | string;
  noWrap?: boolean;
};

export default function DeliveryRangeText({
  tone,
  rangeLabel,
  lead,
  variant = "body2",
  fontSize,
  noWrap
}: Props) {
  return (
    <Typography
      component="span"
      variant={variant}
      color="text.secondary"
      noWrap={noWrap}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize, minWidth: 0 }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: TONE_COLOR[tone],
          flexShrink: 0
        }}
      />
      {lead} {rangeLabel}
    </Typography>
  );
}
