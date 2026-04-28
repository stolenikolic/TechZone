"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(() => ({
  height: "100%",
  margin: "auto",
  display: "flex",
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 250ms ease-in-out",
  ":hover": {
    ".prev-btn": { opacity: 1, left: 10 },
    ".next-btn": { opacity: 1, right: 10 },
    ".hover-buttons": { opacity: 1, bottom: 5 }
  }
}));

export const ImageWrapper = styled("div")(({ theme }) => ({
  maxHeight: 370,
  aspectRatio: 1,
  borderRadius: 12,
  textAlign: "center",
  position: "relative",
  display: "inline-block",
  backgroundColor: theme.palette.grey[50],
  [theme.breakpoints.down("sm")]: { display: "block" },
  ".thumbnail": {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  }
}));

export const HoverButtonsWrapper = styled("div")(() => ({
  zIndex: 2,
  bottom: 0,
  opacity: 0,
  width: "100%",
  cursor: "pointer",
  position: "absolute",
  transition: "all 0.3s ease-in-out",
  gap: ".75rem",
  display: "flex",
  alignItems: "center",
  padding: "1rem 2rem",
  ".MuiButton-root": { padding: ".75rem" },
  ".add-to-cart-btn": { width: "100%" }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  zIndex: 2,
  textAlign: "center",
  position: "relative",
  padding: "1.5rem 1rem",
  ".title": {
    marginBottom: ".5rem",
    ":hover": { textDecoration: "underline" }
  },
  ".category": {
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: "uppercase",
    color: theme.palette.grey[400]
  }
}));
