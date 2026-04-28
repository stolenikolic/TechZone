"use client";

import { styled } from "@mui/material/styles";

export default styled("div")(({ theme }) => ({
  display: "flex",
  overflow: "hidden",
  position: "relative",
  ":hover:after": { opacity: 0.3 },
  ":after": {
    inset: 0,
    zIndex: 1,
    opacity: 0,
    content: '""',
    width: "100%",
    height: "100%",
    position: "absolute",
    transition: "opacity 250ms ease-in-out",
    backgroundColor: theme.palette.action.active
  }
}));
