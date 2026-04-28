"use client";

import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const StyledCard = styled("div")(({ theme }) => ({
  height: "100%",
  margin: "auto",
  position: "relative",
  transition: "all 250ms ease-in-out",
  boxShadow: theme.shadows[1],
  ":hover": { boxShadow: theme.shadows[5] }
}));

export const ImageWrapper = styled("div")(({ theme }) => ({
  height: 230,
  marginBottom: "5rem",
  padding: "60px 40px 20px 40px",
  background: theme.palette.grey[100],
  ".img-wrapper": { maxWidth: 300, margin: "auto" }
}));

export const StatusWrapper = styled("div")(({ theme }) => ({
  width: 40,
  height: 42,
  zIndex: 11,
  top: "0px",
  right: "30px",
  fontSize: "12px",
  position: "absolute",
  background: theme.palette.primary.main,
  ".chip": {
    color: "#fff",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  ".triangle": {
    width: "100%",
    display: "flex",
    "& > div": {
      width: 0,
      height: 0,
      borderTop: "0px solid transparent",
      borderBottom: "10px solid transparent"
    },
    ".triangle-left": {
      borderLeft: `20px solid ${theme.palette.primary.main}`
    },
    ".triangle-right": {
      borderRight: `20px solid ${theme.palette.primary.main}`
    }
  }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  gap: 8,
  display: "flex",
  padding: "1rem",
  ".content": {
    flex: "1 1 0",
    h3: {
      fontSize: 20,
      marginBottom: ".5rem",
      color: theme.palette.text.primary
    }
  }
}));

export const ColorsWrapper = styled("div")(({ theme }) => ({
  gap: 8,
  display: "flex",
  paddingBlock: ".5rem",
  "& div": {
    width: 12,
    height: 12,
    borderRadius: 8,
    "&:hover": {
      cursor: "pointer",
      outline: `2px solid ${theme.palette.grey[200]}`
    }
  }
}));

export const StyledButton = styled(Button)(({ theme }) => ({
  padding: "3px",
  borderRadius: 0,
  alignSelf: "self-end",
  transition: "all 0.3s",
  color: theme.palette.primary.main,
  ":hover": {
    color: "#fff",
    background: theme.palette.primary.main,
    border: `1px solid ${theme.palette.primary.main}`
  }
}));
