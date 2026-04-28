"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  transition: "all 300ms ease-in-out",
  ":hover": { boxShadow: theme.shadows[5] }
}));

export const PriceText = styled("p")(({ theme }) => ({
  gap: 8,
  fontSize: 17,
  lineHeight: 1,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  color: theme.palette.primary.main,
  ".base-price": {
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "line-through",
    color: theme.palette.grey[400]
  }
}));

export const Content = styled("div")(({ theme }) => ({
  padding: 18,
  gap: ".5rem",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "end",
  justifyContent: "space-between",
  ".title": {
    fontSize: 17,
    fontWeight: 600
  },
  ".offer": {
    marginBottom: "1rem",
    color: theme.palette.grey[400]
  }
}));
