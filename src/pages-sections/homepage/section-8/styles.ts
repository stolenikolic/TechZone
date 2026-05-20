"use client";

import { styled } from "@mui/material/styles";

export const ImageContainer = styled("div")(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  margin: "auto",
  maxWidth: 110,
  height: 50,
  "& img": { filter: "grayscale(1)", objectFit: "contain" }
}));
