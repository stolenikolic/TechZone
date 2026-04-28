"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  display: "grid",
  padding: "2rem 0",
  borderRadius: ".5rem",
  gridTemplateColumns: "repeat(4, 1fr)",
  backgroundColor: theme.palette.grey[50],
  [theme.breakpoints.down("md")]: {
    gap: 30,
    gridTemplateColumns: "repeat(2, 1fr)"
  },
  [theme.breakpoints.down("sm")]: {
    gap: 30,
    paddingLeft: "2rem",
    paddingRight: "2rem",
    gridTemplateColumns: "1fr"
  }
}));

export const ServiceItem = styled("div")(({ theme }) => ({
  flexGrow: 1,
  gap: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: `1px solid ${theme.palette.divider}`,
  ":last-child": { borderRight: 0 },
  [theme.breakpoints.down("md")]: {
    ":nth-of-type(even)": { borderRight: 0 }
  },
  [theme.breakpoints.down("sm")]: {
    borderRight: 0,
    justifyContent: "flex-start"
  }
}));
