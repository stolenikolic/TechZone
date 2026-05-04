"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
export const Wrapper = styled(Card)({
  width: "100%",
  overflow: "hidden",
  position: "relative",
  marginBottom: "1.25rem"
});

export const ContentWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  "& .img-wrapper": {
    width: 150,
    flexShrink: 0,
    position: "relative",
    backgroundColor: theme.palette.grey[50]
  },
  "& .content": {
    flex: 1,
    padding: "1rem",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between"
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    "& .img-wrapper": { width: "100%" },
    "& .content": { width: "100%" }
  }
}));

export const TagRoot = styled("div")(({ theme }) => ({
  display: "block",
  lineHeight: 1.5,
  marginBottom: theme.spacing(0.25),
  "& span": {
    fontWeight: 500,
    letterSpacing: 0.2
  }
}));
