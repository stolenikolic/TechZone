"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "bgWhite"
})<{ bgWhite?: boolean }>(({ theme, bgWhite }) => ({
  height: "100%",
  margin: "auto",
  display: "flex",
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 250ms ease-in-out",
  backgroundColor: theme.palette.grey[50],
  ":hover": {
    ".thumbnail": {
      display: "none"
    },
    ".hover-box": {
      opacity: 1,
      bottom: 5
    },
    ".hover-thumbnail": {
      display: "flex",
      transition: "all 0.3s ease-in-out"
    }
  },
  ...(bgWhite && {
    backgroundColor: "white",
    border: `1px solid ${theme.palette.grey[100]}`
  })
}));

export const ImageWrapper = styled("div")(({ theme }) => ({
  height: 370,
  aspectRatio: 1,
  display: "grid",
  cursor: "pointer",
  textAlign: "center",
  position: "relative",
  placeItems: "center",
  [theme.breakpoints.down("sm")]: {
    height: "100%"
  },
  "& > a": {
    position: "absolute",
    inset: 0,
    display: "block"
  },
  ".hover-thumbnail": {
    display: "none",
    transition: "all 0.3s ease-in-out"
  },
  ".thumbnail, .hover-thumbnail": {
    objectFit: "contain"
  }
}));

export const ImageContainer = styled("div")(() => ({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  aspectRatio: "1 / 1"
}));

export const HoverWrapper = styled("div")(() => ({
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
  ".view-btn": { backgroundColor: "white" },
  ".MuiButton-root": { padding: ".75rem" },
  a: { width: "100%" }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  zIndex: 2,
  position: "relative",
  paddingTop: "1rem",
  textAlign: "center",
  paddingInline: "1rem",
  paddingBottom: "1.5rem",
  ".title": {
    cursor: "pointer",
    marginBottom: ".5rem",
    ":hover": {
      textDecoration: "underline"
    }
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
