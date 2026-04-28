// =================================================================
declare module "@mui/material/styles" {
  interface PaletteColor {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  }

  interface SimplePaletteColorOptions {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  }

  interface Palette {
    gold: SimplePaletteColorOptions;
    dark: SimplePaletteColorOptions;
    paste: SimplePaletteColorOptions;
    marron: SimplePaletteColorOptions;
    orange: SimplePaletteColorOptions;
    bluish: SimplePaletteColorOptions;
    topbar?: { main: string };
    footer?: { main: string };
    price?: { main: string };
  }

  interface PaletteOptions {
    gold: SimplePaletteColorOptions;
    dark: SimplePaletteColorOptions;
    paste: SimplePaletteColorOptions;
    marron: SimplePaletteColorOptions;
    orange: SimplePaletteColorOptions;
    bluish: SimplePaletteColorOptions;
    topbar?: { main: string };
    footer?: { main: string };
    price?: { main: string };
  }
}
// =================================================================

export const grey = {
  50: "#FAFAFA", // Brightest
  100: "#F5F5F5", // Soft background
  200: "#E5E7EB", // Line Stroke
  300: "#D1D5DB",
  400: "#9CA3AF", // Border - limit as bg
  500: "#6B7280",
  600: "#4B5563", // Low Priority Text
  700: "#374151",
  800: "#1F2937", // Paragraph
  900: "#111827", // Main Text
  A100: "#FFFFFF",
  A200: "#F9FAFB",
  A400: "#D1D5DB",
  A700: "#1F2937"
};

export const primary = {
  50: "#E6F5FB",
  100: "#C0E6F7",
  200: "#97D6F2",
  300: "#6DC6EC",
  400: "#4BBBE8",
  500: "#08ADEA",
  600: "#099BCF",
  700: "#0A86B3",
  800: "#0D739A",
  900: "#126388",

  main: "#08ADEA",
  light: "#E6F5FB",
  dark: "#126388",
  contrastText: "#FFFFFF"
};

export const secondary = {
  100: "#e8e8ee",
  200: "#b9bacb",
  300: "#8a8ca8",
  400: "#5b5d85",
  500: "#08ADEA",
  600: "#099BCF",
  700: "#0A86B3",
  800: "#0D739A",
  900: "#126388",

  main: "#08ADEA",
  dark: "#126388",
  light: "#E6F5FB",
  contrastText: "#FFFFFF"
};

export const error = {
  100: "#FFEAEA",
  200: "#FFCBCB",
  300: "#FFA9A9",
  400: "#FF6D6D",
  500: "#FF5353",
  600: "#FF4C4C",
  700: "#FF4242",
  800: "#FF3939",
  900: "#FF2929",
  main: "#E94560",
  dark: "#FF2929",
  light: "#FFEAEA",
  contrastText: "#FFFFFF"
};

export const success = {
  50: "#F0FDF4",
  100: "#DCFCE7",
  200: "#B9F8CF",
  300: "#7BF1A8",
  400: "#05DF72",
  500: "#00C950",
  600: "#00A63E",
  700: "#008236",
  800: "#016630",
  900: "#0D542B",
  main: "#00C950",
  dark: "#00A63E",
  light: "#7BF1A8",
  contrastText: "#FFFFFF"
};

export const blue = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BEDBFF",
  300: "#8EC5FF",
  400: "#51A2FF",
  500: "#2B7FFF",
  600: "#155DFC",
  700: "#1447E6",
  800: "#193CB8",
  900: "#1C398E",
  main: "#2B7FFF",
  dark: "#155DFC",
  light: "#EAF7FE",
  contrastText: "#FFFFFF"
};

export const marron = {
  50: "#FAF0F1",
  100: "#EEDADA",
  200: "#DFB9BA",
  300: "#D29D9E",
  400: "#C58283",
  500: "#B86667",
  600: "#A74E4F",
  700: "#8B4142",
  800: "#6F3435",
  900: "#532727",
  main: "#B86667",
  dark: "#A74E4F",
  light: "#FAF0F1",
  contrastText: "#FFFFFF"
};

export const paste = {
  50: "#F0FAFA",
  100: "#E2F4F4",
  200: "#BEE4E4",
  300: "#A1D8D8",
  400: "#85CCCC",
  500: "#68C0C0",
  600: "#4BB4B4",
  700: "#3F9797",
  800: "#337A7A",
  900: "#275E5E",
  main: "#68C0C0",
  dark: "#4BB4B4",
  light: "#F0FAFA",
  contrastText: "#FFFFFF"
};

export const orange = {
  50: "#FEF1E3",
  100: "#FDDDBD",
  200: "#FCC487",
  300: "#FCB05F",
  400: "#FB9C37",
  500: "#FA8C16",
  600: "#C86904",
  700: "#A05403",
  800: "#783F03",
  900: "#502A02",
  main: "#FA8C16",
  dark: "#C86904",
  light: "#FEF1E3",
  contrastText: "#FFFFFF"
};

export const bluish = {
  50: "#e6f7f7",
  100: "#cceff0",
  200: "#a2dedd",
  300: "#4bb4b4",
  400: "#22a4a3",
  500: "#009491",
  600: "#008783",
  700: "#257181",
  800: "#175368",
  900: "#0E3D56",
  main: "#4BB4B4",
  dark: "#008783",
  light: "#e6f7f7",
  contrastText: "#FFFFFF"
};

export const warning = {
  50: "#FFF6DC",
  100: "#FFE9B1",
  200: "#FFDB84",
  300: "#FFCE58",
  400: "#FFC33E",
  500: "#FFB82A",
  600: "#E9A222",
  700: "#C88C1D",
  800: "#A87518",
  900: "#865F13",
  main: "#FFB82A",
  dark: "#C88C1D",
  light: "#FFF6DC",
  contrastText: "#FFFFFF"
};

export const gold = {
  50: "#FFF8DC",
  100: "#FDEDAE",
  200: "#FCE17F",
  300: "#FBD64F",
  400: "#FACC2D",
  500: "#F4B500",
  600: "#DCA300",
  700: "#BD8A00",
  800: "#9E7200",
  900: "#805900",
  main: "#F4B500",
  dark: "#805900",
  light: "#FFF8DC",
  contrastText: "#FFFFFF"
};

export const dark = {
  ...grey,
  main: "#126388",
  dark: "#0E4F6C",
  light: grey[100],
  contrastText: "#fff"
};
