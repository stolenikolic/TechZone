"use client";

import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";

export const CardContent = styled("div")(() => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center"
}));

export const LinkText = styled(Typography)(({ theme }) => ({
  marginTop: "1.5rem",
  textDecoration: "underline",
  textTransform: "uppercase",
  textDecorationLine: "underline",
  textDecorationSkipInk: "none",
  textDecorationThickness: "2px",
  textUnderlineOffset: "8px",
  [theme.breakpoints.up("sm")]: { marginTop: "3rem" }
}));

export const ImageContainer = styled("div")(({ theme }) => ({
  maxWidth: 350,
  width: "100%",
  height: 240,
  margin: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  "& img": {
    display: "block",
    width: "auto",
    height: "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain"
  },
  [theme.breakpoints.up("md")]: {
    height: 320
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: 250,
    height: 220
  }
}));
