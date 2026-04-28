import type { PropsWithChildren } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
// STYLED COMPONENT
import { StyledScrollbar } from "./styles";

// =============================================================
interface ScrollbarProps extends PropsWithChildren {
  className?: string;
  sx?: SxProps<Theme>;
}
// =============================================================

export default function OverlayScrollbar({ sx, children, className }: ScrollbarProps) {
  return (
    <StyledScrollbar
      defer
      sx={sx}
      className={className}
      options={{ scrollbars: { autoHide: "leave", autoHideDelay: 100 } }}
    >
      {children}
    </StyledScrollbar>
  );
}
