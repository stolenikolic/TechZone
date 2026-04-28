"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  ".title": {
    fontSize: 48,
    marginTop: 0,
    fontWeight: 900,
    lineHeight: 1.2,
    marginBottom: "1rem",
    maxWidth: "500px"
  },
  ".description": {
    fontSize: 18,
    marginBottom: theme.spacing(4),
    color: theme.palette.grey[600]
  },
  ".button-link": {
    height: 44,
    borderRadius: 8
  },
  ".img-wrapper": {
    height: 400,
    display: "flex",
    marginInline: "auto",
    position: "relative",
    img: { objectFit: "contain" }
  },
  [theme.breakpoints.up("md")]: {
    ".grid-item": {
      minHeight: 424,
      display: "flex",
      alignItems: "baseline",
      flexDirection: "column",
      justifyContent: "center"
    }
  },
  [theme.breakpoints.down("md")]: {
    marginLeft: 0,
    paddingLeft: 0,
    textAlign: "center",
    ".grid-item": { order: 2 },
    ".description": { fontSize: 16 },
    ".button-link": { marginBottom: "2rem" },
    ".img-wrapper": { width: 300, height: 300 },
    ".title": {
      fontSize: 32,
      marginInline: "auto",
      marginBottom: ".75rem"
    }
  },
  [theme.breakpoints.down("xs")]: {
    ".title + *": { fontSize: 13 },
    ".title": {
      fontSize: 16,
      fontWeight: 700
    },
    ".button-link": {
      height: 36,
      fontSize: 13,
      padding: "0 1.5rem"
    }
  }
}));
