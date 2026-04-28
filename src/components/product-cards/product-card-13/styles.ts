"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const CardRoot = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  position: "relative",
  border: `1px solid ${theme.palette.divider}`,
  img: {
    transition: "scale 0.3s cubic-bezier(0, 0, 0.2, 1) 0ms"
  },
  ":hover img": { scale: "0.9" },
  ".content": {
    padding: "1rem",
    textAlign: "center",
    ".title": { fontWeight: 600, fontSize: 17 },
    ".tag": { color: theme.palette.grey[400] }
  }
}));

export const PriceText = styled("p")(({ theme }) => ({
  fontSize: 16,
  fontWeight: 600,
  color: theme.palette.primary.main,
  span: {
    fontSize: 14,
    marginInlineStart: 6,
    fontWeight: 500,
    textDecoration: "line-through",
    color: theme.palette.grey[400],
    ":dir(rtl)": {
      marginInlineEnd: 6,
      marginInlineStart: 0
    }
  }
}));
