"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const CardLink = styled(Link)({
  display: "block",
  width: "100%",
  maxWidth: "100%"
});

export const StyledRoot = styled("div")(({ theme }) => ({
  marginBottom: "4rem",
  maxWidth: "100%",
  overflowX: "hidden",
  "& .content-wrapper": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "stretch",
    maxWidth: "100%",
    overflowX: "hidden",
    margin: theme.spacing(-1),
    [theme.breakpoints.down("lg")]: {
      flexDirection: "column",
      margin: 0,
      gap: theme.spacing(2)
    }
  }
}));

export const Icon = styled("div")(({ theme }) => ({
  fontSize: 25,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: theme.spacing(2),
  color: theme.palette.grey[400],
  [theme.breakpoints.down("lg")]: {
    display: "none"
  }
}));

export const TotalCount = styled("div")(({ theme }) => ({
  width: "100%",
  minHeight: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  margin: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  boxSizing: "border-box",
  ".btn-wrapper": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing(1.5)
  },
  [theme.breakpoints.up("lg")]: {
    width: "auto",
    minWidth: 300,
    flex: "0 0 auto"
  },
  [theme.breakpoints.down("lg")]: {
    margin: 0
  }
}));

export const ItemCard = styled(Card)(({ theme }) => ({
  width: "100%",
  padding: "1rem",
  boxSizing: "border-box",
  margin: theme.spacing(1),
  [theme.breakpoints.up("lg")]: {
    flex: "1 1 0",
    minWidth: 160,
    maxWidth: 220
  },
  [theme.breakpoints.down("lg")]: {
    flex: "none",
    maxWidth: "100%",
    margin: 0
  }
}));

export const Price = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  "& del": { color: theme.palette.grey[600] }
}));
