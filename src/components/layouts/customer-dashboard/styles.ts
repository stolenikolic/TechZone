"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const MainContainer = styled(Card)(({ theme }) => ({
  paddingBottom: "1rem",
  [theme.breakpoints.down("md")]: {
    boxShadow: "none",
    overflowY: "auto",
    height: "calc(100vh - 64px)"
  }
}));

export const StyledLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "isActive"
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  display: "flex",
  alignItems: "center",
  padding: ".5rem 1.5rem",
  borderLeft: "3px solid transparent",
  justifyContent: "space-between",
  transition: "all 0.2s ease-in-out",
  color: theme.palette.text.secondary,
  ".title": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  ":hover": {
    color: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    ".nav-icon": { color: theme.palette.primary.main }
  },
  ...(isActive && {
    color: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    "& .nav-icon": { color: theme.palette.primary.main }
  })
}));
