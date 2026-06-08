import type { Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

const TOUCH_SAFE_INPUT_FONT_PX = 16;

/** Frosted bar below the notch — keep the fixed wrapper itself transparent for Safari tinting. */
export function mobileFrostedChrome(theme: Theme) {
  return {
    backgroundColor: alpha(theme.palette.background.paper, 0.72),
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.55)}`
  };
}
const DESKTOP_INPUT_FONT_PX = 14;

/** Prevents iOS/Android auto-zoom on input focus while keeping pinch-to-zoom. */
export function touchSafeInputFontSize(theme: Theme) {
  return {
    fontSize: TOUCH_SAFE_INPUT_FONT_PX,
    [`@media (pointer: fine) and (min-width: ${theme.breakpoints.values.sm}px)`]: {
      fontSize: DESKTOP_INPUT_FONT_PX
    }
  };
}

export const classes = () => {
  const obj = {} as Record<string, React.CSSProperties>;

  for (let i = 1; i <= 5; i++) {
    // PADDING
    obj[`.p-${i}`] = { padding: i + "rem" };
    obj[`.pt-${i}`] = { paddingTop: i + "rem" };
    obj[`.pb-${i}`] = { paddingBottom: i + "rem" };

    // MARGIN
    obj[`.m-${i}`] = { margin: i + "rem" };
    obj[`.mt-${i}`] = { marginTop: i + "rem" };
    obj[`.mb-${i}`] = { marginBottom: i + "rem" };
  }

  return obj;
};
