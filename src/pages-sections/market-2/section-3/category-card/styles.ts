"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  borderRadius: 12,
  overflow: "hidden",
  border: `1px solid ${theme.palette.grey[100]}`,
  ".title": {
    padding: "1rem",
    textAlign: "center"
  },
  ":hover": {
    ".title": { textDecoration: "underline" },
    ".category-image": { scale: 1.03 }
  }
}));

export const ImageContainer = styled("div")(({ theme }) => ({
  display: "flex",
  padding: "2rem",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  backgroundColor: theme.palette.grey[50],
  ".category-image": {
    transition: "scale 0.75s cubic-bezier(0.2, 0.75, 0.5, 1)"
  }
}));
