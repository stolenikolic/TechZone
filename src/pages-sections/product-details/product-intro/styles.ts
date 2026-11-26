"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  width: "100%",
  padding: "1.5rem",
  [theme.breakpoints.down("sm")]: {
    paddingInline: "0.5rem"
  },
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.grey[50],
  "& strong": { fontWeight: 600 },
  "& .rating": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2)
  },
  "& .price": {
    paddingTop: theme.spacing(1),
    marginBottom: theme.spacing(3)
  },
  "& .shop": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  "& .variant-group": {
    gap: "0.5rem",
    display: "flex",
    alignItems: "center",
    "& .MuiChip-root": { height: 28, cursor: "pointer", borderRadius: "6px" }
  }
}));

export const ProductImageWrapper = styled("div")(({ theme }) => ({
  height: 500,
  display: "flex",
  overflow: "hidden",
  position: "relative",
  justifyContent: "center",
  marginBottom: theme.spacing(6),
  touchAction: "pan-y",
  "& img": { objectFit: "contain" },
  [theme.breakpoints.down("sm")]: {
    height: 300,
    marginBottom: theme.spacing(1.5)
  }
}));

export const GalleryActions = styled("div")({
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  gap: 8
});

export const PreviewImages = styled("div")(({ theme }) => ({
  overflow: "auto",
  display: "flex",
  gap: theme.spacing(1),
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: { display: "none" }
}));

export const GalleryDots = styled("div")(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  }
}));

export const GalleryDot = styled("button", {
  shouldForwardProp: (prop) => prop !== "selected"
})<{ selected: boolean }>(({ theme, selected }) => ({
  width: selected ? 10 : 8,
  height: selected ? 10 : 8,
  padding: 0,
  border: 0,
  borderRadius: "50%",
  cursor: "pointer",
  backgroundColor: selected ? theme.palette.primary.main : theme.palette.grey[400],
  transition: "background-color 0.2s ease, width 0.2s ease, height 0.2s ease"
}));

export const PreviewImage = styled("div", {
  shouldForwardProp: (prop) => prop !== "selected"
})<{ selected: boolean }>(({ theme, selected }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  overflow: "hidden",
  width: 64,
  height: 64,
  cursor: "pointer",
  position: "relative",
  backgroundColor: "white",
  opacity: selected ? 1 : 0.5,
  transition: "all 0.2s ease-in-out",
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`
}));
