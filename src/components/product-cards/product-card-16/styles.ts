"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  borderRadius: 12,
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  "&:hover .img-wrapper img": { scale: 1.1 },
  "& .wishlist-heart": {
    opacity: 0,
    transition: "opacity 0.2s ease-in-out"
  },
  "@media (hover: hover)": {
    "&:hover .wishlist-heart": { opacity: 1 }
  },
  "@media (hover: none)": {
    "& .wishlist-heart": { opacity: 1 }
  },
  "& .img-wrapper": {
    display: "block",
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    flexShrink: 0,
    backgroundColor: theme.palette.grey[50],
    overflow: "hidden",
    "& img": { transition: "0.3s", objectFit: "contain" }
  },
  "& .content": {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0
  },
  "& .content-main": {
    flex: 1,
    display: "flex",
    flexDirection: "column"
  },
  "& .product-title": {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    marginBottom: theme.spacing(1),
    minHeight: `calc(${theme.typography.h6.lineHeight} * 3em)`
  },
  "& .content-footer": {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    flexShrink: 0
  }
}));

export const PriceText = styled("p")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 600,
  margin: 0,
  minWidth: 0,
  flex: 1,
  color: theme.palette.price?.main ?? "#2B3445",
  ".base-price": {
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 500,
    textDecoration: "line-through",
    color: theme.palette.grey[600]
  },
  ".base-price--original": {
    color: theme.palette.primary.main
  }
}));
