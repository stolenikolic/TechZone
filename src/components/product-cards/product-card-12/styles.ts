"use client";

import { styled } from "@mui/material/styles";

export const ImageWrapper = styled("h6")(({ theme }) => ({
  display: "flex",
  borderRadius: 12,
  marginBottom: "1rem",
  backgroundColor: theme.palette.grey[50],
  "& img": { transition: "all 1s cubic-bezier(0, 0, 0.1, 1)" },
  "&:hover": { img: { scale: 0.9 } }
}));

export const Title = styled("h6")(() => ({
  fontSize: 17,
  fontWeight: 600
}));

export const PriceText = styled("p")(({ theme }) => ({
  fontSize: 17,
  fontWeight: 600,
  color: theme.palette.primary.main,
  ".base-price": {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: 600,
    textDecoration: "line-through",
    color: theme.palette.grey[600]
  }
}));
