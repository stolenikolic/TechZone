"use client";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Stack from "@mui/material/Stack";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import DeliveryRangeText from "components/delivery/delivery-range-text";
import type { CartDeliverySummary } from "lib/cart/cart-display-meta";

type Props = {
  summary: CartDeliverySummary;
  compact?: boolean;
};

export default function CartDeliverySummaryBlock({ summary, compact }: Props) {
  if (!summary.globalRangeLabel || !summary.globalTone) return null;

  const mb = compact ? 1.5 : 2;
  const bodyVariant = compact ? "body2" : "body1";

  if (summary.hasMixedDeliveryBands) {
    return (
      <Alert
        severity="warning"
        variant="outlined"
        icon={<LocalShippingOutlined fontSize="small" />}
        sx={{
          mb,
          py: compact ? 1 : 1.25,
          "& .MuiAlert-message": { width: "100%" }
        }}
      >
        <AlertTitle sx={{ fontWeight: 700, mb: 0.5, fontSize: compact ? 13 : 14 }}>
          Rokovi isporuke se razlikuju po stavkama.
        </AlertTitle>
        <DeliveryRangeText
          tone={summary.globalTone}
          rangeLabel={summary.globalRangeLabel}
          lead="Cijela narudžba:"
          variant={bodyVariant}
        />
      </Alert>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb }}>
      <LocalShippingOutlined sx={{ fontSize: compact ? 18 : 20, color: "text.secondary" }} />
      <DeliveryRangeText
        tone={summary.globalTone}
        rangeLabel={summary.globalRangeLabel}
        lead="Isporuka narudžbe:"
        variant={bodyVariant}
      />
    </Stack>
  );
}
