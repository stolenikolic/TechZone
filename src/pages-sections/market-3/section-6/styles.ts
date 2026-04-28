"use client";

import { styled } from "@mui/material/styles";

export const BannerBox = styled("div", {
  shouldForwardProp: (prop) => prop !== "img"
})<{ img: string }>(({ theme, img }) => ({
  minHeight: 260,
  borderRadius: 12,
  overflow: "hidden",
  padding: "3rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  backgroundImage: `linear-gradient(90deg, ${theme.palette.common.white} 0%, rgba(255, 255, 255, 0.72) 48%, rgba(255, 255, 255, 0) 100%), url(${img})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  ".subtitle": {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.grey[600],
    textTransform: "uppercase"
  },
  ".title": {
    margin: "0.5rem 0 1rem",
    fontSize: 28,
    lineHeight: 1.2
  },
  ".MuiDivider-root": {
    width: 80,
    borderColor: theme.palette.primary.main,
    borderBottomWidth: 2
  },
  ".price": {
    margin: "1rem 0 0",
    fontSize: 14,
    color: theme.palette.grey[700],
    span: {
      fontSize: 20,
      fontWeight: 700,
      color: theme.palette.primary.main
    }
  },
  "&.text-white": {
    backgroundImage: `linear-gradient(90deg, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0.28) 48%, rgba(0, 0, 0, 0) 100%), url(${img})`,
    ".subtitle, .title, .price": {
      color: theme.palette.common.white
    },
    ".price span": {
      color: theme.palette.common.white
    },
    ".MuiDivider-root": {
      borderColor: theme.palette.common.white
    }
  },
  [theme.breakpoints.down("sm")]: {
    minHeight: 220,
    padding: "2rem"
  }
}));
