import { keyframes, styled } from "@mui/material/styles";

// ==============================================================
interface Props {
  fixed?: boolean;
  fixedOn?: number;
  componentHeight?: number;
  chromeHidden?: boolean;
}
// ==============================================================

const slideDown = keyframes`
    from {transform: translateY(-200%)}
    to {transform: translateY(0)}
`;

export const StyledRoot = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "componentHeight" && prop !== "fixed" && prop !== "fixedOn" && prop !== "chromeHidden"
})<Props>(({ theme, componentHeight, fixedOn, fixed, chromeHidden }) => ({
  paddingTop: fixed ? componentHeight : 0,
  ".hold": {
    zIndex: 2,
    boxShadow: "none",
    position: "relative"
  },
  ".fixed": {
    left: 0,
    right: 0,
    zIndex: 1500,
    position: "fixed",
    top: `${fixedOn}px`,
    boxShadow: theme.shadows[5],
    [theme.breakpoints.down("lg")]: {
      willChange: "transform",
      transition: chromeHidden
        ? "transform 200ms ease-in"
        : "transform 160ms ease-out",
      transform: chromeHidden ? "translateY(-100%)" : "translateY(0)"
    },
    [theme.breakpoints.up("lg")]: {
      transition: "all 350ms ease-in-out",
      animation: `${slideDown} 400ms ${theme.transitions.easing.easeInOut}`
    }
  }
}));
