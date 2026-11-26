import type { SxProps, Theme } from "@mui/material/styles";

/** Transparent circle used on product images and category cards. */
export const imageActionButtonSx: SxProps<Theme> = {
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: "50%",
  color: "grey.800",
  backgroundColor: "rgba(255, 255, 255, 0.72)",
  boxShadow: "0 1px 3px rgba(43, 52, 69, 0.16)",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.9)"
  }
};
