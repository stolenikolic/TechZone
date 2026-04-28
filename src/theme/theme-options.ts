import { type ThemeOptions } from "@mui/material/styles";
import { components, typography, getPalette } from "./core";
import { COLORS, type ThemeMapping } from "./types";

const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1600,
    xxl: 1920
  }
};

let oldMapping: ThemeMapping;

const themeMappings = [
  { paths: ["/admin", "/vendor"], color: COLORS.HEALTH }
];

export default function themeOptions(pathname: string) {
  let selectedMapping = themeMappings.find((mapping) =>
    mapping.paths.some((path) => pathname.startsWith(path))
  );

  if (["/mini-cart", "/login"].includes(pathname)) {
    selectedMapping = oldMapping;
  }

  // GET THE COLOR PALETTE BASED ON THE SELECTED MAPPING
  const selectedPalette = getPalette(selectedMapping?.color || COLORS.DARK);

  // STORE THE SELECTED MAPPING IN OLD MAPPING FOR MODAL ROUTES -> LOGIN, MINI-CART
  oldMapping = selectedMapping!;

  const themeOption: ThemeOptions = {
    typography,
    components,
    breakpoints,
    palette: selectedPalette
  };

  return themeOption;
}
