import ButtonBase from "@mui/material/ButtonBase";
import { styled } from "@mui/material/styles";
// CUSTOM ICON COMPONENT
import ChevronRight from "icons/ChevronRight";

// ===============================================================
type Active = { active: boolean };
type Collapse = { collapsed: boolean };
// ===============================================================

export const NavExpandRoot = styled("div")(({ theme }) => ({
  "& .expansion-panel": {
    overflow: "hidden",
    position: "relative",
    paddingLeft: "1.5rem",
    ":before": {
      content: "''",
      height: "100%",
      insetInlineStart: 8,
      position: "absolute",
      borderInlineStart: `1px solid ${theme.palette.divider}`
    }
  }
}));

export const NavItemButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== "active"
})<Active>(({ theme, active }) => ({
  height: 44,
  width: "100%",
  whiteSpace: "nowrap",
  justifyContent: "flex-start",
  transition: "all 0.15s ease",
  ...(active && {
    fontWeight: 500,
    color: theme.palette.primary.main,
    "& .MuiSvgIcon-root": { color: theme.palette.primary.main }
  }),
  ":hover": {
    color: theme.palette.primary.main,
    "& .MuiSvgIcon-root": { color: theme.palette.primary.main }
  }
}));

export const ChevronRightIcon = styled(ChevronRight, {
  shouldForwardProp: (prop) => prop !== "collapsed"
})<Collapse>(({ collapsed, theme }) => ({
  fontSize: "1rem",
  color: theme.palette.grey[500],
  transform: collapsed ? "0deg" : "rotate(90deg)",
  transition: "transform 0.3s cubic-bezier(0, 0, 0.2, 1) 0ms",
  ...(collapsed && theme.direction === "rtl" && { transform: "rotate(180deg)" })
}));

export const ListIconWrapper = styled("div")(({ theme }) => ({
  width: 22,
  height: 22,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  marginInlineEnd: "0.8rem",
  justifyContent: "center",
  "& svg": {
    width: "100%",
    height: "100%",
    color: theme.palette.grey[500]
  }
}));
