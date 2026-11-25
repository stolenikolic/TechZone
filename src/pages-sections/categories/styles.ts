"use client";

import Link from "next/link";
import { styled } from "@mui/material/styles";

export const RowLink = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  width: "100%",
  minHeight: 88,
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  textDecoration: "none",
  color: theme.palette.grey[900],
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.divider}`,
  transition: "background-color 200ms ease, color 200ms ease",
  ".title": {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.35
  },
  ".caret": {
    flexShrink: 0,
    fontSize: "1rem",
    color: theme.palette.grey[400],
    ":dir(rtl)": { rotate: "180deg" }
  },
  ":hover": {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
    ".caret": { color: theme.palette.primary.main }
  }
}));

export const ImageBox = styled("div")(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  width: 64,
  height: 64,
  borderRadius: 8,
  overflow: "hidden",
  backgroundColor: theme.palette.grey[50],
  ".thumb": {
    width: "100% !important",
    height: "100% !important",
    objectFit: "contain",
    padding: 6
  },
  ".placeholder": {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.grey[500],
    fontSize: 18,
    fontWeight: 600
  }
}));
