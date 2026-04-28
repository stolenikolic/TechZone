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
  margin: "auto",
  textAlign: "center",
  img: {
    width: "100%",
    height: "auto"
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: 250
  }
}));
