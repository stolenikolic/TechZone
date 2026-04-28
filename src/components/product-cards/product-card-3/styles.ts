"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")({
  height: "100%",
  margin: "auto",
  display: "flex",
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between"
});

export const ImageWrapper = styled("div")(({ theme }) => ({
  height: "100%",
  borderRadius: 12,
  overflow: "hidden",
  textAlign: "center",
  position: "relative",
  display: "inline-block",
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: { display: "block" },
  "&:hover": {
    "& .hoverButtonBox": { opacity: 1 },
    "& .hoverImgBox": { filter: "blur(5px)" }
  }
}));

export const HoverButtonBox = styled("div")({
  opacity: 0,
  top: "50%",
  left: "50%",
  width: "100%",
  height: "100%",
  position: "absolute",
  transition: ".5s ease",
  transform: "translate(-50%, -50%)",
  "& .buttonBox": {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    position: "relative",
    flexDirection: "column",
    justifyContent: "center",
    "& .addCartButton": {
      bottom: 20,
      margin: "auto",
      padding: "4px 14px",
      position: "absolute",
      "& svg": { fontSize: 16 }
    }
  }
});

export const ImageBox = styled("div")(({ theme }) => ({
  opacity: 1,
  height: "100%",
  display: "grid",
  placeItems: "center",
  padding: "44px 40px",
  transition: "all .3s ease",
  backgroundColor: theme.palette.grey[50]
}));

export const ItemController = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  overflow: "hidden",
  borderRadius: "5px",
  backgroundColor: "#fff",
  boxShadow: theme.shadows[2],
  "& svg": {
    fontSize: 22,
    color: theme.palette.grey[600]
  },
  "& span": {
    width: "100%",
    height: "100%",
    display: "flex",
    padding: "6px 12px",
    alignItems: "center",
    "&:hover": { cursor: "pointer", backgroundColor: "#f3f5f9" }
  }
}));

export const ContentWrapper = styled("div")({
  padding: "1rem",
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center"
});
