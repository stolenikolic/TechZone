"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const Wrapper = styled(Card)(({ theme }) => ({
  width: "100%",
  overflow: "hidden",
  position: "relative",
  marginBottom: "1.5rem",
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  [theme.breakpoints.down("sm")]: {
    marginBottom: theme.spacing(2)
  }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "stretch",
  flexDirection: "row",
  "& .img-wrapper": {
    width: 150,
    height: 150,
    alignSelf: "center",
    flexShrink: 0,
    position: "relative",
    backgroundColor: theme.palette.grey[50],
    overflow: "hidden",
    "& img": {
      width: "100% !important",
      height: "100% !important",
      objectFit: "contain"
    }
  },
  "& .content": {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
    padding: "1rem",
    display: "flex",
    alignItems: "stretch",
    gap: theme.spacing(1.5)
  },
  "& .copy": {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start"
  },
  "& .actions": {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    flexShrink: 0
  },
  "& .product-title": {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    wordBreak: "break-word"
  },
  "& .list-price": {
    display: "flex",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "baseline",
    columnGap: theme.spacing(1),
    rowGap: 2,
    marginTop: "auto",
    maxWidth: "100%",
    paddingTop: theme.spacing(0.5)
  },
  "& .list-price-now, & .list-price-was": {
    whiteSpace: "nowrap"
  },
  "& .list-price-now": {
    fontWeight: 600,
    lineHeight: 1.2,
    color: theme.palette.price?.main ?? theme.palette.grey[900]
  },
  "& .list-price-was": {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.2,
    color: theme.palette.grey[400]
  },
  "& .list-price-was--original": {
    color: theme.palette.primary.main
  },
  [theme.breakpoints.up("sm")]: {
    "& .product-title": { WebkitLineClamp: 3 }
  },
  [theme.breakpoints.down("sm")]: {
    "& .img-wrapper": {
      width: 72,
      height: 72,
      alignSelf: "flex-start",
      marginTop: theme.spacing(1.25),
      marginBottom: theme.spacing(1.25)
    },
    "& .content": {
      minHeight: 0,
      padding: theme.spacing(1.25, 1.25, 1.25, 1)
    },
    "& .actions": {
      justifyContent: "flex-start",
      gap: theme.spacing(1)
    },
    "& .list-price": {
      marginTop: theme.spacing(0.75)
    },
    "& .product-title": {
      WebkitLineClamp: 2,
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 1.35
    }
  }
}));
