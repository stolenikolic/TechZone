import type { Theme, Components, ThemeOptions } from "@mui/material/styles";

export type Typography = Partial<Theme["typography"]>;

export type Palette = ThemeOptions["palette"];

export type ThemeComponents = Components<Theme>;

export enum COLORS {
  RED = "RED",
  DARK = "DARK",
  GOLD = "GOLD",
  GIFT = "GIFT",
  PASTE = "PASTE",
  GREEN = "GREEN",
  ORANGE = "ORANGE",
  BLUISH = "BLUISH",
  YELLOW = "YELLOW",
  HEALTH = "HEALTH"
}

export type ThemeMapping = {
  paths: string[];
  color: COLORS;
};
