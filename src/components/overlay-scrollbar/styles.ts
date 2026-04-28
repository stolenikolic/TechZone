"use client";

import { alpha, styled } from "@mui/material/styles";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

export const StyledScrollbar = styled(OverlayScrollbarsComponent)(({ theme }) => ({
  maxHeight: "100%",
  ".os-theme-dark": {
    "--os-size": "9px",
    "--os-handle-bg": alpha(theme.palette.grey[400], 0.5),
    "--os-handle-bg-hover": alpha(theme.palette.grey[400], 0.6),
    "--os-handle-bg-active": alpha(theme.palette.grey[400], 0.6)
  }
}));
