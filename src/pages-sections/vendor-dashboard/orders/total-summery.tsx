"use client";

import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FlexBetween } from "components/flex-box";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

// ==============================================================
interface Props {
  subtotal: number;
  shippingTotal: number;
  discount: number;
  tax?: number;
  paymentMethod?: string;
}

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}
// ==============================================================

/** Uska polja kao u Bazaar templejtu — samo broj, bez širenja preko pola kartice. */
const narrowInputSx = {
  width: { xs: "100%", sm: 95 },
  maxWidth: "100%",
  flexShrink: 0,
  "& .MuiOutlinedInput-root": { zIndex: 0 },
  "& .MuiOutlinedInput-input": {
    py: "8.5px",
    textAlign: "right" as const
  }
} as const;

export default function TotalSummery({
  subtotal,
  shippingTotal,
  discount,
  tax = 0,
  paymentMethod
}: Props) {
  const [shippingStr, setShippingStr] = useState(() => String(shippingTotal));
  const [discountStr, setDiscountStr] = useState(() => String(discount));

  useEffect(() => {
    setShippingStr(String(shippingTotal));
    setDiscountStr(String(discount));
  }, [shippingTotal, discount]);

  const shippingVal = parseAmount(shippingStr);
  const discountVal = parseAmount(discountStr);
  /** Porez nije u UI; ako postoji u bazi, i dalje ulazi u total. */
  const computedTotal =
    Math.round((subtotal + shippingVal + tax - discountVal) * 100) / 100;

  const numberSlotProps = { htmlInput: { step: "0.01", min: 0 as number } };

  return (
    <Card sx={{ px: 3, py: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Total Summary
      </Typography>

      <FlexBetween mb={1.5} alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="body1" sx={{ color: "grey.600" }}>
          Subtotal:
        </Typography>
        <Typography variant="h6">{currency(subtotal)}</Typography>
      </FlexBetween>

      <FlexBetween mb={1.5} alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="body1" sx={{ color: "grey.600", flexShrink: 0 }}>
          Shipping fee:
        </Typography>
        <TextField
          hiddenLabel
          size="small"
          type="number"
          name="shipping_fee"
          value={shippingStr}
          onChange={(e) => setShippingStr(e.target.value)}
          sx={narrowInputSx}
          slotProps={numberSlotProps}
        />
      </FlexBetween>

      <FlexBetween mb={1.5} alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="body1" sx={{ color: "grey.600", flexShrink: 0 }}>
          Discount:
        </Typography>
        <TextField
          hiddenLabel
          size="small"
          type="number"
          name="discount"
          value={discountStr}
          onChange={(e) => setDiscountStr(e.target.value)}
          sx={narrowInputSx}
          slotProps={numberSlotProps}
        />
      </FlexBetween>

      <Divider sx={{ my: 2 }} />

      <FlexBetween mb={2}>
        <Typography variant="h6">Total</Typography>
        <Typography variant="h6">{currency(computedTotal)}</Typography>
      </FlexBetween>

      <Typography variant="body2" color="text.secondary">
        Payment method: {paymentMethod || "Cash on Delivery"}
      </Typography>
    </Card>
  );
}
