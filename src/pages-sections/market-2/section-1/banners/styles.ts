"use client";

import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

export const BannerImageWrap = styled("div")(({ theme }) => ({
  flexShrink: 0,
  width: 140,
  height: 140,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: theme.spacing(1),
  "& img": {
    display: "block",
    width: "auto",
    height: "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain"
  },
  [theme.breakpoints.up("sm")]: {
    width: 160,
    height: 160
  },
  [theme.breakpoints.up("lg")]: {
    width: 177,
    height: 188
  }
}));

export const BannerRoot = styled("div")(({ theme }) => ({
  flex: 1,
  // gap: 8,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: theme.palette.grey[50],
  overflow: "hidden",
  padding: "1rem 1.5rem",
  ".content": { flexShrink: 0 }
}));

export const LinkText = styled(Typography)(() => ({
  marginTop: "1rem",
  textDecoration: "underline",
  textTransform: "uppercase",
  textDecorationLine: "underline",
  textDecorationSkipInk: "none",
  textDecorationThickness: "2px",
  textUnderlineOffset: "0.5rem"
}));
