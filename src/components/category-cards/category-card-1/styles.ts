"use client";

import { styled } from "@mui/material/styles";

// STYLED COMPONENTS
export const Wrapper = styled("div")(({ theme }) => ({
  height: "100%",
  cursor: "pointer",
  overflow: "hidden",
  borderRadius: 12,
  position: "relative",
  border: `1px solid ${theme.palette.divider}`,
  img: {
    height: "100%",
    objectFit: "cover",
    transition: "all 0.3s",
    objectPosition: "center center"
  },
  ".category-title": {
    borderRadius: 12
  },
  ":hover": {
    img: { transform: "scale(1.1)" },
    ".category-title": {
      color: theme.palette.common.white,
      backgroundColor: theme.palette.dark.main
    }
  }
}));

export const CategoryTitle = styled("div")(({ theme }) => ({
  left: 10,
  right: 10,
  bottom: 10,
  padding: 8,
  textAlign: "center",
  borderRadius: "2px",
  position: "absolute",
  transition: "all 0.3s",
  backgroundColor: theme.palette.grey[50],
  p: { fontSize: 16, fontWeight: 500 }
}));
