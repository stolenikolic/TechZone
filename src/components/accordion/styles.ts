"use client";

import { styled } from "@mui/material/styles";

// STYLED COMPONENT
export const RootContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "open"
})<{ open?: boolean }>(({ open }) => ({
  display: "flex",
  alignItems: "center",
  padding: ".5rem 1rem",
  justifyContent: "space-between",
  ".caret": {
    fontSize: "1rem",
    transition: "transform 250ms ease-in-out",
    transform: `rotate(${open ? "90deg" : "0deg"})`,
    ":dir(rtl)": {
      transform: `rotate(${open ? "90deg" : "180deg"})`
    }
  }
}));
