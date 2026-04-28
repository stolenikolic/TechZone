"use client";

import { styled } from "@mui/material/styles";
import { layoutConstant } from "utils/constants";

export const ContentWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  paddingTop: "1.5rem",
  position: "relative",
  "& > .sidebar": {
    width: "100%",
    height: "100%",
    position: "sticky",
    top: layoutConstant.headerHeight + 15,
    maxWidth: layoutConstant.grocerySidenavWidth,
    [theme.breakpoints.down("lg")]: { display: "none" }
  },
  "& > .content": {
    width: "100%",
    paddingLeft: "2rem",
    maxWidth: `calc(100% - ${layoutConstant.grocerySidenavWidth}px)`,
    [theme.breakpoints.down("lg")]: { maxWidth: "100%", paddingLeft: 0 }
  }
}));
