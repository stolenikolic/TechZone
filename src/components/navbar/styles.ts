"use client";

import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
// GLOBAL CUSTOM COMPONENTS
import { NavLink } from "components/nav-link";

// COMMON STYLED OBJECT
export const NAV_LINK_STYLES = {
  fontWeight: 500,
  cursor: "pointer",
  transition: "color 150ms ease-in-out",
  "&:hover": { color: "primary.main" },
  "&:last-child": { marginRight: 0 }
};

export const StyledNavLink = styled(NavLink)({ ...NAV_LINK_STYLES });

export const ParentNav = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active"
})<{ active: number }>(({ theme, active }) => ({
  position: "relative",
  ...(active && { color: theme.palette.primary.main }),
  "& .arrow": { fontSize: ".875rem" },
  ":dir(rtl) .arrow": { transform: "rotate(180deg)" },
  "&:hover": {
    color: theme.palette.primary.main,
    "& > .parent-nav-item": { display: "block" }
  }
}));

export const ParentNavItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "right"
})<{ right: boolean }>(({ right }) => ({
  top: 0,
  zIndex: 5,
  left: "100%",
  paddingLeft: 8,
  display: "none",
  position: "absolute",
  ...(right && { right: "100%", left: "auto", paddingRight: 8 })
}));

export const ChildNavListWrapper = styled("div")({
  zIndex: 5,
  left: "50%",
  top: "100%",
  display: "none",
  position: "absolute",
  transform: "translate(-50%, 0%)"
});
