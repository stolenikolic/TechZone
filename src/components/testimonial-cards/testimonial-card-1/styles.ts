"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column"
  }
}));

export const UserInfo = styled(Card)(() => ({
  zIndex: 2,
  minWidth: 220,
  paddingBlock: "2rem",
  display: "flex",
  textAlign: "center",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  backgroundColor: "white",
  boxShadow: "3px 5px 5px 0px rgba(16, 24, 40, 0.02)"
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  width: "100%",
  borderRadius: 12,
  marginInlineStart: "-3rem",
  backgroundColor: theme.palette.grey[50],
  paddingBlock: "5rem",
  paddingLeft: "6rem",
  paddingRight: "4rem",
  [theme.breakpoints.down("sm")]: {
    marginInlineStart: "0",
    padding: "4rem 3rem 3rem 2rem",
    marginTop: "-2rem",
    textAlign: "center"
  },
  [theme.breakpoints.down(375)]: {
    padding: "4rem 1.5rem 1.5rem 1.5rem"
  },
  [theme.breakpoints.up("lg")]: {
    ".content": {
      maxWidth: 720
    }
  }
}));
