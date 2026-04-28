"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const NavbarRoot = styled(Card, {
  shouldForwardProp: (prop) => prop !== "fixed" && prop !== "sidebar"
})<{ sidebar: "transparent" | "colored" }>(({ theme, sidebar }) => ({
  height: "100%",
  paddingBottom: 8,
  overflow: "auto",
  position: "relative",
  "& .linkList": {
    cursor: "pointer",
    padding: "8px 20px",
    transition: "all 0.2s",
    color: theme.palette.grey[700],
    ":hover": { color: theme.palette.primary.main }
  },

  "& .list-item": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5)
  },

  "& .list-item.active": {
    color: theme.palette.primary.main
  },

  ...(sidebar === "colored" && {
    paddingBottom: 10,
    backgroundColor: theme.palette.primary[50]
  })
}));

export const StyledList = styled("div", {
  shouldForwardProp: (prop) => prop !== "active"
})<{ active: boolean }>(({ theme, active }) => ({
  display: "flex",
  cursor: "pointer",
  padding: "4px 20px",
  alignItems: "center",
  transition: "all 0.2s",
  color: theme.palette.grey[700],
  "& > p": { paddingBlock: ".25rem" },
  ":hover": {
    color: theme.palette.primary.main,
    ".dot": { backgroundColor: theme.palette.primary.main }
  },
  ...(active && {
    color: theme.palette.primary.main,
    ".dot": { backgroundColor: theme.palette.primary.main }
  })
}));

export const Circle = styled("span")(({ theme }) => ({
  width: 4,
  height: 4,
  marginLeft: "2rem",
  marginRight: "8px",
  borderRadius: "3px",
  backgroundColor: theme.palette.grey[600]
}));

export const BorderBox = styled("div", {
  shouldForwardProp: (prop) => prop !== "line"
})<{ line: "dash" | "solid" }>(({ theme, line }) => ({
  marginTop: 5,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 15,
  "& span": { width: "100%" },
  ...(line === "dash" && {
    borderBottom: "2px",
    borderStyle: "none none dashed none",
    borderColor: theme.palette.primary.main,
    "& span": { display: "none" }
  })
}));

export const ColorBorder = styled("span", {
  shouldForwardProp: (prop) => prop !== "grey"
})<{ grey?: number }>(({ grey, theme }) => ({
  borderRadius: "2px 0 0 2px",
  height: grey ? "2px" : "3px",
  background: grey ? theme.palette.grey[400] : theme.palette.primary[200]
}));
