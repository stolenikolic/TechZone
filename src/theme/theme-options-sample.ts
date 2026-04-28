import { ThemeOptions } from "@mui/material/styles";
import { components, typography, getPalette } from "./core";
import { COLORS } from "./types";

/********************************************
 * You can delete themeOptions.ts file and
 * rename this file to `themeOptions.ts`
 * Follow the documentation for more details
 *********************************************/

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

export default function themeOptions() {
  // YOU CAN SET ANOTHER COLOR PALETTE HERE E.G. [COLORS.GROCERY] OR [COLORS.FURNITURE] ETC.
  const palette = getPalette(COLORS.DARK);

  const themeOption: ThemeOptions = {
    typography,
    components,
    breakpoints,
    palette
  };

  return themeOption;
}
