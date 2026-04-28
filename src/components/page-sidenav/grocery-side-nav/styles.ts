"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  position: "relative",
  // padding: "20px 20px 14px 24px",
  "& .accordion": {
    padding: 0,
    cursor: "pointer",
    ":hover": { color: theme.palette.primary.main }
  }
}));
