"use client";

import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import { styled } from "@mui/material/styles";
import { layoutConstant } from "utils/constants";

export const StyledRoot = styled("div", {
  shouldForwardProp: (prop) => prop !== "bgColor"
})<{ bgColor?: string }>(({ theme, bgColor }) => ({
  display: "none",
  fontSize: 14,
  paddingBlock: 14,
  color: theme.palette.secondary.contrastText,
  background: bgColor ?? theme.palette.topbar?.main ?? theme.palette.grey[800],
  [theme.breakpoints.up(layoutConstant.topbarMinWidth)]: {
    display: "block"
  },
  [theme.breakpoints.down("lg")]: {
    paddingTop: `calc(14px + env(safe-area-inset-top, 0px))`
  }
}));

export const StyledContainer = styled(Container)(() => ({
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem"
}));

export const StyledChip = styled(Chip)(({ theme }) => ({
  color: "white",
  fontWeight: 600,
  backgroundColor: theme.palette.primary.main,
  "& .MuiChip-label": { paddingInline: ".8rem" }
}));

export const LeftContent = styled("div")(() => ({
  overflow: "hidden",
  ".tag": {
    fontSize: 13,
    gap: ".5rem",
    display: "flex",
    alignItems: "center"
  },
  span: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
}));

export const RightContent = styled("div")(() => ({
  gap: "1rem",
  flexShrink: 0,
  display: "flex",
  alignItems: "center"
}));
