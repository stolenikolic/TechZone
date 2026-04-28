"use client";

import Chip, { ChipProps } from "@mui/material/Chip";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "shape"
})<{ shape: "rounded" | "square" }>(({ shape }) => ({
  zIndex: 1,
  top: "15px",
  left: "15px",
  paddingLeft: 3,
  paddingRight: 3,
  fontWeight: 500,
  borderRadius: 8,
  fontSize: "10px",
  position: "absolute",
  ...(shape === "square" && { borderRadius: 0 })
}));

// ==============================================================
interface Props extends ChipProps {
  discount: number;
  shape?: "rounded" | "square";
}
// ==============================================================

export default function DiscountChip({ discount = 0, shape = "rounded", ...props }: Props) {
  return discount > 0 ? (
    <StyledChip size="small" shape={shape} label={`${discount}% off`} {...props} />
  ) : null;
}
