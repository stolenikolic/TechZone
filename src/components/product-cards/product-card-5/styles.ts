"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card)(({ theme }) => ({
  margin: "auto",
  height: "100%",
  display: "flex",
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 250ms ease-in-out",
  border: `1px solid ${theme.palette.divider}`,
  ":hover": {
    boxShadow: theme.shadows[1],
    ".controller": { right: 10 }
  }
}));

export const ImageWrapper = styled("div")(({ theme }) => ({
  height: "100%",
  textAlign: "center",
  position: "relative",
  display: "inline-block",
  [theme.breakpoints.down("sm")]: { display: "block" }
}));

export const ImageBox = styled("div")(({ theme }) => ({
  padding: "3rem",
  height: "100%",
  borderBottom: `1px solid ${theme.palette.divider}`
}));

export const HoverWrapper = styled("div")(({ theme }) => ({
  top: 0,
  bottom: 0,
  width: 35,
  right: -40,
  height: 120,
  margin: "auto",
  display: "flex",
  background: "#fff",
  overflow: "hidden",
  borderRadius: "5px",
  alignItems: "center",
  position: "absolute",
  flexDirection: "column",
  boxShadow: theme.shadows[2],
  justifyContent: "space-between",
  transition: "right 0.3s ease-in-out",
  ".hover-link": {
    width: "100%",
    height: "100%",
    display: "flex",
    cursor: "pointer",
    padding: "10px 0px",
    alignItems: "center",
    justifyContent: "center",
    ":hover": {
      backgroundColor: theme.palette.action.hover
    }
  },
  svg: {
    fontSize: 18,
    color: theme.palette.grey[400]
  }
}));

export const ContentWrapper = styled("div")({
  padding: "1rem",
  "& .title, & .categories": {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
});

export const ButtonGroup = styled("div")(({ theme }) => ({
  gap: 10,
  display: "flex",
  marginTop: "15px",
  justifyContent: "space-between",
  "& button": {
    color: "#fff",
    background: theme.palette.primary.main,
    "&:hover": { background: theme.palette.primary[600] }
  }
}));
