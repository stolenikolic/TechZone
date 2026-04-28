"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

// STYLED COMPONENTS
export const RootStyle = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  boxShadow: theme.shadows[0],
  border: `1px solid ${theme.palette.grey[100]}`,
  ":hover": { boxShadow: theme.shadows[6] },
  ".content": {
    paddingTop: ".5rem",
    paddingInline: "1rem",
    paddingBottom: "1.5rem",
    ".description": {
      marginTop: ".25rem",
      marginBottom: "1rem"
    }
  }
}));

export const ImageBox = styled("div")(({ theme }) => ({
  margin: 16,
  height: 250,
  borderRadius: 12,
  cursor: "pointer",
  overflow: "hidden",
  position: "relative",
  img: {
    transition: "0.3s",
    display: "block",
    objectFit: "cover"
  },
  ":hover img": {
    transform: "scale(1.1)"
  },
  [theme.breakpoints.down(426)]: {
    height: 200
  }
}));

export const DateBox = styled("div")(({ theme }) => ({
  top: 20,
  left: 20,
  padding: ".5rem .75rem",
  display: "flex",
  borderRadius: 6,
  textAlign: "center",
  position: "absolute",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.common.white,
  p: {
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 500
  }
}));
