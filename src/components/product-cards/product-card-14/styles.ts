"use client";

import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const StyledRoot = styled("div")(({ theme }) => ({
  ".img-wrapper": {
    display: "flex",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: "1rem",
    backgroundColor: theme.palette.grey[50],
    position: "relative",
    height: 320,
    img: {
      aspectRatio: "1/1",
      objectFit: "cover",
      transition: "all 1s cubic-bezier(0, 0, 0.1, 1)"
    },
    [theme.breakpoints.up("lg")]: { height: 280 },
    [theme.breakpoints.up("md")]: { height: 320 },
    [theme.breakpoints.up("sm")]: { height: 280 }
  },
  ":hover .img-wrapper > img": { scale: 0.9 },
  ":hover .add-to-cart": {
    color: "white",
    backgroundColor: theme.palette.primary.main
  }
}));

export const PriceText = styled("p")(({ theme }) => ({
  gap: 8,
  fontSize: 16,
  fontWeight: 600,
  marginTop: 4,
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.primary.main,
  ".base-price": {
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "line-through",
    color: theme.palette.grey[400]
  }
}));

export const Content = styled("div")(() => ({
  textAlign: "center",
  maxWidth: "90%",
  margin: "auto",
  paddingBottom: 8
}));

export const StyledButton = styled(Button)(({ theme }) => ({
  height: 40,
  marginTop: 8,
  backgroundColor: theme.palette.grey[50],
  ":hover": {
    color: "white",
    backgroundColor: theme.palette.primary.main
  }
}));

export const StyledChip = styled(Chip)(({ theme }) => ({
  zIndex: 1,
  top: 15,
  left: 15,
  height: 28,
  fontSize: 12,
  borderRadius: 6,
  position: "absolute",
  color: theme.palette.common.black,
  border: `1px solid ${theme.palette.grey[100]}`,
  backgroundColor: theme.palette.common.white
}));
