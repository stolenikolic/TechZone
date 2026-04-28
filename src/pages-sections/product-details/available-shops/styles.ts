"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  padding: theme.spacing(3.25),
  "& .shop-avatar": { width: 48, height: 48 },
  "& .shop-name": {
    fontSize: 17,
    fontWeight: 500,
    marginTop: theme.spacing(1.5),
    color: theme.palette.grey[800]
  }
}));
