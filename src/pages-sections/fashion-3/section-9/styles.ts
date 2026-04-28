"use client";

import { styled } from "@mui/material/styles";

export const RootStyle = styled("div")(({ theme }) => ({
  height: "100%",
  display: "flex",
  overflow: "hidden",
  borderRadius: 12,
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.grey[200]}`,
  transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  ":hover": {
    borderColor: theme.palette.primary.main,
    boxShadow: theme.shadows[2],
    ".img-wrapper img": {
      transform: "scale(1.06)"
    }
  },
  ".img-wrapper": {
    width: 120,
    height: "100%",
    flexShrink: 0,
    display: "grid",
    overflow: "hidden",
    minHeight: 120,
    placeItems: "center",
    backgroundColor: theme.palette.grey[50],
    img: {
      objectFit: "contain",
      transition: "transform 0.3s ease"
    }
  },
  ".content": {
    minWidth: 0,
    flex: "1 1 auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  },
  [theme.breakpoints.down("sm")]: {
    ".img-wrapper": {
      width: 100,
      minHeight: 100
    },
    ".content": {
      padding: "0.75rem"
    }
  }
}));
