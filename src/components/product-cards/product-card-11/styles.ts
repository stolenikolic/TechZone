"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const CardRoot = styled(Card)(({ theme }) => ({
  position: "relative",
  border: `1px solid ${theme.palette.grey[100]}`,
  ":hover .img-wrapper img": { transform: "scale(1.1)" },
  ".content": { padding: "1rem" },
  ".flex-between": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  ".img-wrapper": {
    height: 350,
    position: "relative",
    "& img": {
      objectFit: "contain",
      transition: "0.3s"
    }
  }
}));

export const PriceText = styled("p")(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.grey[600],
  textDecoration: "line-through"
}));

export const SaleBadge = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  top: 12,
  left: 12,
  width: 50,
  height: 50,
  borderRadius: "50%",
  position: "absolute",
  color: theme.palette.common.white,
  backgroundColor: theme.palette.primary.main
}));
