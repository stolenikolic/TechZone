"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  marginBottom: "4rem",
  "& .content-wrapper": {
    display: "flex",
    flexWrap: "wrap",
    margin: theme.spacing(-1),
    [theme.breakpoints.down("sm")]: { flexDirection: "column" }
  }
}));

export const Icon = styled("div")(({ theme }) => ({
  fontSize: 25,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: theme.spacing(2),
  color: theme.palette.grey[400]
}));

export const TotalCount = styled("div")(({ theme }) => ({
  minWidth: 300,
  minHeight: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  margin: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  ".btn-wrapper": {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5)
  }
}));

export const ItemCard = styled(Card)(({ theme }) => ({
  width: "100%",
  flex: "1 1 0",
  padding: "1rem",
  minWidth: "160px",
  maxWidth: "220px",
  margin: theme.spacing(1),
  [theme.breakpoints.down("sm")]: { maxWidth: "100%", margin: 0 }
}));

export const Price = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  "& del": { color: theme.palette.grey[600] }
}));
