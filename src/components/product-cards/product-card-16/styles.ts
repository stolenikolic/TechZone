"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  borderRadius: 12,
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  "&:hover .img-wrapper img": { scale: 1.1 },
  "& .img-wrapper": {
    display: "block",
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    backgroundColor: theme.palette.grey[50],
    overflow: "hidden",
    "& img": { transition: "0.3s", objectFit: "contain" }
  },
  "& .content": {
    padding: "1rem",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between"
  }
}));

export const PriceText = styled("p")(({ theme }) => ({
  fontSize: 17,
  lineHeight: 1,
  fontWeight: 600,
  marginTop: ".75rem",
  color: theme.palette.price?.main ?? "#2B3445",
  ".base-price": {
    fontSize: 13,
    marginLeft: 8,
    textDecoration: "line-through",
    color: theme.palette.grey[600]
  }
}));
