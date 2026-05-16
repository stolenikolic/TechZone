import Drawer from "@mui/material/Drawer";
import { styled } from "@mui/material/styles";
import { NavLink } from "components/nav-link";
import { layoutConstant } from "utils/constants";

// STYLED COMPONENTS — icon row (64px) + safe-area strip below (iPhone home indicator)
const Wrapper = styled("div")(({ theme }) => ({
  left: 0,
  right: 0,
  bottom: 0,
  display: "none",
  position: "fixed",
  flexDirection: "column",
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: theme.palette.background.paper,
  boxShadow: "0px 1px 4px 3px rgba(0, 0, 0, 0.1)",
  [theme.breakpoints.down("lg")]: { display: "flex", width: "100vw" }
}));

const NavRow = styled("div")({
  display: "flex",
  flexShrink: 0,
  width: "100%",
  height: layoutConstant.mobileNavHeight,
  alignItems: "center",
  justifyContent: "space-around"
});

const SafeAreaInset = styled("div")(({ theme }) => ({
  flexShrink: 0,
  width: "100%",
  height: "env(safe-area-inset-bottom, 0px)",
  backgroundColor: theme.palette.background.paper
}));

const StyledNavLink = styled(NavLink)({
  flex: "1 1 0",
  display: "flex",
  fontSize: "13px",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  "& .icon": {
    display: "flex",
    marginBottom: "4px",
    alignItems: "center",
    justifyContent: "center"
  }
});

const StyledBox = styled("div")(({ theme }) => ({
  flex: "1 1 0",
  display: "flex",
  fontSize: "13px",
  cursor: "pointer",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  transition: "color 150ms ease-in-out",
  "&:hover": { color: `${theme.palette.primary.main} !important` }
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 250,
  zIndex: 1501,
  flexShrink: 0,
  "& .MuiDrawer-paper": {
    width: 250,
    boxSizing: "border-box",
    boxShadow: theme.shadows[2]
  }
}));

export { Wrapper, NavRow, SafeAreaInset, StyledBox, StyledNavLink, StyledDrawer };
