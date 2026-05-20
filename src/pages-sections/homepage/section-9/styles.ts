"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  height: 300,
  borderRadius: 12,
  overflow: "hidden",
  position: "relative",
  [theme.breakpoints.up("sm")]: { height: 350 },
  [theme.breakpoints.up("md")]: { height: 400 },
  [theme.breakpoints.up("lg")]: { height: 440 }
}));

export const StyledContent = styled("div")(({ theme }) => ({
  position: "absolute",
  left: 120,
  insetBlock: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "1.5rem",
  maxWidth: 400,
  width: "100%",
  [theme.breakpoints.down("md")]: {
    left: 0,
    insetBlock: 0,
    padding: "0 2rem"
  }
}));
