"use client";

import { styled } from "@mui/material/styles";

export const NavbarRoot = styled("div")(({ theme }) => ({
  height: "100%",
  borderRadius: 0,
  position: "relative",
  ".title": {
    marginBottom: 8,
    padding: "10px 18px",
    borderRadius: "0 0 12px 12px",
    backgroundColor: theme.palette.primary.light
  },
  ".list-item": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    paddingBlock: theme.spacing(1),
    transition: "all 150ms ease-in-out",
    ":hover": { color: theme.palette.primary.main }
  },
  ".list-item.active": {
    color: theme.palette.primary.main
  }
}));

export const DotListItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "active"
})<{ active: boolean }>(({ theme, active }) => ({
  gap: 8,
  display: "flex",
  paddingBlock: 10,
  alignItems: "center",
  transition: "all 0.2s",
  ":hover": {
    color: theme.palette.primary.main,
    ".dot": {
      backgroundColor: theme.palette.primary.main
    }
  },
  ...(active && {
    color: theme.palette.primary.main,
    ".dot": {
      backgroundColor: theme.palette.primary.main
    }
  })
}));

export const Circle = styled("div")(({ theme }) => ({
  width: 4,
  height: 4,
  borderRadius: 3,
  marginLeft: "2rem",
  backgroundColor: theme.palette.grey[400]
}));
