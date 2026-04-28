"use client";

import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

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
