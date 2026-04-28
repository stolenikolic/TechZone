import { alpha } from "@mui/material/styles";
import {
  blue,
  dark,
  gold,
  grey,
  paste,
  error,
  marron,
  orange,
  bluish,
  success,
  warning,
  primary,
  secondary
} from "./theme-colors";
import { Palette, COLORS } from "theme/types";

/*
WE CREATED MULTIPLE COLOR PALETTE FOR DIFFERENT SHOP VARIATION.

YOU CAN JUST KEEP [COLORS.DARK] AND REMOVE OTHER COLOR PALETTE.
*/

const demoColors = {
  [COLORS.DARK]: primary,
  [COLORS.PASTE]: paste,
  [COLORS.HEALTH]: blue,
  [COLORS.GIFT]: marron,
  [COLORS.ORANGE]: orange,
  [COLORS.GOLD]: gold,
  [COLORS.BLUISH]: bluish,
  [COLORS.GREEN]: success,
  [COLORS.YELLOW]: warning,
  [COLORS.RED]: primary
};

export const getPalette = (color: COLORS): Palette => {
  const selectedPrimaryColor = demoColors[color || COLORS.DARK];

  return {
    dark,
    grey,
    gold,
    paste,
    error,
    orange,
    marron,
    bluish,
    warning,
    success,
    secondary,
    info: blue,
    divider: grey[200],
    topbar: { main: "#1F2937" },
    footer: { main: "#111827" },
    price: { main: "#2B3445" },
    primary: selectedPrimaryColor,
    background: {
      paper: "#fff",
      default: "#fff"
    },
    text: {
      primary: grey[800],
      secondary: grey[600],
      disabled: grey[400]
    },
    action: {
      focus: alpha(grey[700], 0.12),
      hover: alpha(grey[700], 0.04),
      active: alpha(grey[700], 0.54),
      selected: alpha(grey[700], 0.08),
      disabled: alpha(grey[700], 0.26),
      disabledBackground: alpha(grey[700], 0.12),
      activatedOpacity: 0.12,
      focusOpacity: 0.12,
      hoverOpacity: 0.04,
      selectedOpacity: 0.08,
      disabledOpacity: 0.26
    }
  };
};
