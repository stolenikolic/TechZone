"use client";

import { styled } from "@mui/material/styles";

export const CardRoot = styled("div")(({ theme }) => ({
  height: "100%",
  display: "flex",
  maxHeight: 340,
  borderRadius: 12,
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  ":hover img": { scale: 1.05 },
  img: {
    width: "100%",
    height: "100%",
    aspectRatio: "16/9",
    objectFit: "cover",
    objectPosition: "center",
    transition: "scale 0.75s cubic-bezier(0.2, 0.75, 0.5, 1)"
  },
  [theme.breakpoints.down(425)]: { height: 275 }
}));

export const CardContent = styled("div")(() => ({
  top: 0,
  left: 0,
  gap: "1rem",
  width: "100%",
  height: "100%",
  padding: "2rem",
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "space-between"
}));
