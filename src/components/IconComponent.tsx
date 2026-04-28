"use client";

import type { SvgIconProps } from "@mui/material/SvgIcon";
// CUSTOM ICON COMPONENTS
import appIcons from "icons";

// ==============================================================
interface Props extends SvgIconProps {
  icon: string;
}

type Keys = keyof typeof appIcons;
// ==============================================================

export default function IconComponent({ icon, ...props }: Props) {
  if (!icon) return null;

  const Icon = appIcons[icon as Keys];
  return Icon ? <Icon {...props} /> : null;
}
