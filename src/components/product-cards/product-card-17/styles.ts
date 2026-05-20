"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "bgWhite"
})<{ bgWhite?: boolean }>(({ theme, bgWhite }) => ({
  height: "100%",
  width: "100%",
  minWidth: 0,
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
  width: "100%",
  height: 370,
  maxWidth: "100%",
  aspectRatio: "1 / 1",
  display: "grid",
  cursor: "pointer",
  textAlign: "center",
  position: "relative",
  placeItems: "center",
  [theme.breakpoints.down("sm")]: {
    height: "auto"
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
  maxWidth: "100%",
  height: "100%",
  overflow: "hidden",
  aspectRatio: "1 / 1"
}));

export const HoverWrapper = styled("div", {
  shouldForwardProp: (prop) => prop !== "compact"
})<{ compact?: boolean }>(({ compact }) => ({
  zIndex: 2,
  bottom: 0,
  opacity: 0,
  width: "100%",
  cursor: "pointer",
  position: "absolute",
  transition: "all 0.3s ease-in-out",
  gap: compact ? "0.5rem" : ".75rem",
  display: "flex",
  alignItems: "center",
  padding: compact ? "0.5rem 0.75rem" : "1rem 2rem",
  ".view-btn": { backgroundColor: "white" },
  ".MuiButton-root": compact
    ? {
        padding: "0.35rem 0.65rem",
        fontSize: "0.75rem",
        lineHeight: 1.25,
        minHeight: 32,
        whiteSpace: "nowrap",
        textTransform: "none"
      }
    : { padding: ".75rem" },
  a: { width: "100%", minWidth: 0 }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  zIndex: 2,
  width: "100%",
  minWidth: 0,
  position: "relative",
  paddingTop: "1rem",
  textAlign: "center",
  paddingInline: "1rem",
  paddingBottom: "1.5rem",
  ".title": {
    cursor: "pointer",
    marginBottom: "1rem",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    minHeight: `calc(${theme.typography.h5.lineHeight} * 2em)`,
    ":hover": {
      textDecoration: "underline"
    }
  },
  ".price-group": {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    lineHeight: 1.15
  },
  ".original-price": {
    margin: 0,
    lineHeight: 1.15
  },
  ".effective-price": {
    margin: 0,
    marginTop: "2px",
    lineHeight: 1.15
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
