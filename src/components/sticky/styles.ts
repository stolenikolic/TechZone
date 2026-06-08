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
  // When chrome is hidden, drop the spacer so page content fills the full display (incl. behind URL bar).
  paddingTop: fixed && !chromeHidden ? componentHeight : 0,
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
      top: 0,
      boxShadow: "none",
      willChange: "transform",
      transform: chromeHidden ? "translateY(-100%)" : "translateY(0)",
      // Safari 26+ still samples fixed elements at the top even when translated off-screen.
      // visibility:hidden removes the header from tinting so scrolling content shows behind the URL bar.
      visibility: chromeHidden ? "hidden" : "visible",
      transition: chromeHidden
        ? "transform 180ms ease-in, visibility 0s linear 180ms"
        : "transform 160ms ease-out, visibility 0s linear 0s"
    },
    [theme.breakpoints.up("lg")]: {
      transition: "all 350ms ease-in-out",
      animation: `${slideDown} 400ms ${theme.transitions.easing.easeInOut}`
    }
  }
}));
