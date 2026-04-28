"use client";

import Chip, { ChipProps } from "@mui/material/Chip";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "shape"
})<{ shape: "rounded" | "square" }>(({ shape, theme }) => ({
  zIndex: 1,
  top: 15,
  left: 15,
  height: 28,
  fontSize: 12,
  borderRadius: 6,
  position: "absolute",
  color: theme.palette.common.black,
  border: `1px solid ${theme.palette.grey[100]}`,
  backgroundColor: theme.palette.common.white,
  ...(shape === "square" && { borderRadius: 0 })
}));

// ==============================================================
interface Props extends ChipProps {
  discount: number;
  shape?: "rounded" | "square";
}
// ==============================================================

export default function Discount({ discount = 0, shape = "rounded", ...props }: Props) {
  if (discount > 0) {
    return <StyledChip size="small" shape={shape} label={`${discount}% off`} {...props} />;
  }

  return null;
}
