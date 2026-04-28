import ListItem from "@mui/material/ListItem";
import { styled } from "@mui/material/styles";

// STYLED COMPONENTS
export const Wrapper = styled("div")(({ theme }) => ({
  cursor: "pointer",
  position: "relative",
  transition: "color 150ms ease-in-out",

  "& .menu-title": {
    fontWeight: 500,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: theme.spacing(0.3),
    ".icon": {
      fontSize: "1.1rem",
      color: theme.palette.grey[500]
    }
  },
  ":hover": {
    color: theme.palette.primary.main,
    "& .menu-list": { display: "block" }
  },
  "& .card": {
    overflow: "hidden",
    marginTop: theme.spacing(1.5)
  },
  "& .grid-item": {
    paddingBlock: theme.spacing(2),
    ":nth-of-type(odd)": {
      backgroundColor: theme.palette.grey[50]
    }
  }
}));

type Props = { left: boolean; right: boolean };

export const MenusContainer = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== "left" && prop !== "right"
})<Props>(({ theme, left, right }) => ({
  zIndex: 2,
  top: "100%",
  minWidth: 1000,
  display: "none",
  position: "absolute",
  transform: "translate(-50%, 0%)",
  [theme.breakpoints.down(1070)]: { minWidth: 800 },
  ...(left && { transform: "translate(0%, 0%)" }),
  ...(right && { transform: "translate(-80%, 0%)" }),
  ...(left && right && { transform: "translate(-25%, 0%)" })
}));

export const MenuListItem = styled(ListItem)(({ theme }) => ({
  padding: ".5rem 2rem",
  ":hover": {
    backgroundColor: theme.palette.action.hover
  }
}));
