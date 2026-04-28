"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import ReasonType from "../reason-type";
import PageWrapper from "../../page-wrapper";

export default function RefundSettingPageView() {
  const [refundReq, setRefundReq] = useState("Confirm");
  const [refundTime, setRefundTime] = useState("120 Days");

  const TEXT_FIELD_STYLE = { fontSize: 14, fontWeight: 500, mb: 2 };

  return (
    <PageWrapper title="Refund Setting">
      <Card sx={{ p: 3 }}>
        {/* REFUND TIME AREA */}
        <Typography variant="h5" sx={{ mb: 3 }}>
          Refund Time
        </Typography>

        <TextField
          fullWidth
          color="info"
          size="medium"
          value={refundTime}
          variant="outlined"
          label="Refund Request Generation Time"
          onChange={(e) => setRefundTime(e.target.value)}
          sx={TEXT_FIELD_STYLE}
        />

        <Button color="info" variant="contained">
          Update
        </Button>

        {/* ORDER STATUS AREA */}
        <Typography variant="h5" sx={{ mb: 3, mt: 4 }}>
          Order Status
        </Typography>

        <TextField
          fullWidth
          color="info"
          size="medium"
          value={refundReq}
          variant="outlined"
          label="Enabling Refund Request"
          onChange={(e) => setRefundReq(e.target.value)}
          sx={TEXT_FIELD_STYLE}
        />

        <Button color="info" variant="contained">
          Update
        </Button>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          Refund Reasons
        </Typography>

        <ReasonType />
      </Card>
    </PageWrapper>
  );
}
