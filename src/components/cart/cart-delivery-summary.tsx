"use client";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import type { CartDeliverySummary } from "lib/cart/cart-display-meta";

type Props = {
  summary: CartDeliverySummary;
  compact?: boolean;
};

export default function CartDeliverySummaryBlock({ summary, compact }: Props) {
  if (!summary.globalDateFormatted) return null;

  const mb = compact ? 1.5 : 2;
  const bodyVariant = compact ? "body2" : "body1";

  if (summary.hasMixedDeliveryDates) {
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
        <Typography variant={bodyVariant} color="text.secondary">
          Procijenjena isporuka narudžbe:{" "}
          <Typography component="span" variant="inherit" fontWeight={600} color="text.primary">
            {summary.globalDateFormatted}
          </Typography>
        </Typography>
      </Alert>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mb }}>
      <LocalShippingOutlined
        sx={{ fontSize: compact ? 18 : 20, color: "text.secondary", mt: 0.15 }}
      />
      <Typography variant={bodyVariant} color="text.secondary">
        Procijenjena isporuka narudžbe:{" "}
        <Typography component="span" variant="inherit" fontWeight={600} color="text.primary">
          {summary.globalDateFormatted}
        </Typography>
      </Typography>
    </Stack>
  );
}
