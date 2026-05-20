"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  borderRadius: 12,
  overflow: "hidden",
  border: `1px solid ${theme.palette.grey[100]}`,
  ".title": {
    padding: "1rem",
    textAlign: "center"
  },
  ":hover": {
    ".title": { textDecoration: "underline" },
    ".category-image": { transform: "scale(1.03)" }
  }
}));

export const ImageContainer = styled("div")(({ theme }) => ({
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  overflow: "hidden",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  backgroundColor: theme.palette.common.white,
  ".category-image": {
    width: "100% !important",
    height: "100% !important",
    objectFit: "contain",
    transition: "transform 0.75s cubic-bezier(0.2, 0.75, 0.5, 1)"
  },
  ".category-placeholder": {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.grey[500],
    fontSize: 14
  }
}));
