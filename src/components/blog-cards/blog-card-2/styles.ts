"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(() => ({
  position: "relative"
}));

export const ImageContainer = styled("div")(({ theme }) => ({
  width: "100%",
  height: 250,
  textAlign: "right",
  overflow: "hidden",
  position: "relative",
  marginInlineEnd: "auto",
  borderRadius: "12px 12px 0 0",
  backgroundColor: theme.palette.grey[50],
  img: { objectFit: "cover" },
  [theme.breakpoints.up("sm")]: {
    height: 375,
    maxWidth: 450,
    borderRadius: 12
  }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  padding: "2rem",
  borderRadius: "0 0 12px 12px",
  backgroundColor: theme.palette.grey[50],
  [theme.breakpoints.up("lg")]: { right: 0 },
  [theme.breakpoints.up("sm")]: {
    right: 0,
    top: "50%",
    maxWidth: 450,
    borderRadius: 12,
    position: "absolute",
    transform: "translateY(-50%)"
  },
  ".description": {
    maxWidth: "100%",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    textOverflow: "ellipsis",
    marginTop: ".5rem",
    marginBottom: "2rem"
  }
}));
