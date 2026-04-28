"use client";

import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(() => ({
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative"
}));

export const StyledButton = styled(Button)(() => ({
  bottom: 45,
  left: "50%",
  zIndex: 1111,
  color: "white",
  position: "absolute",
  paddingInline: "2rem",
  transform: "translateX(-50%)"
}));
