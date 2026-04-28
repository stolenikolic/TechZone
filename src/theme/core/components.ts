import { alpha } from "@mui/material/styles";
import { dark, grey, orange, secondary, success } from "./theme-colors";
import { ThemeComponents } from "theme/types";
import { classes } from "theme/utils";
import { typography } from "./typography";

// ========================================================
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    dark: true;
    paste: true;
    marron: true;
    orange: true;
  }

  interface ButtonPropsSizeOverrides {
    normal: true;
  }
}
// =========================================================

export const components: ThemeComponents = {
  MuiCssBaseline: {
    styleOverrides: {
      html: {
        scrollBehavior: "smooth"
      },
      "*": {
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        scrollBehavior: "smooth",
        fontFamily: typography.fontFamily
      },
      button: { fontSize: 14 },
      a: {
        color: "inherit",
        textDecoration: "none"
      },
      ul: {
        margin: 0,
        padding: 0,
        listStyle: "none"
      },
      ".bg-white": {
        backgroundColor: "white"
      },
      ...classes()
    }
  },

  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12,
        boxShadow: "none"
      }
    }
  },
  MuiCard: {
    defaultProps: {
      elevation: 1
    },
    styleOverrides: {
      root: {
        borderRadius: 12
      }
    }
  },
  MuiPagination: {
    defaultProps: {
      color: "primary",
      shape: "rounded",
      variant: "outlined"
    }
  },
  MuiPaginationItem: {
    styleOverrides: {
      rounded: { borderRadius: 8 },
      outlined: { borderColor: grey[300] }
    }
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        paddingTop: 8,
        paddingBottom: 8
      }
    }
  },
  MuiSvgIcon: {
    styleOverrides: {
      root: {
        "& .secondary": { opacity: 0.4 }
      }
    }
  },
  MuiTextField: {
    defaultProps: {
      size: "small",
      variant: "outlined"
    }
  },
  MuiInputLabel: {
    styleOverrides: {
      root: { zIndex: 0 },
      sizeSmall: { lineHeight: "1.8em" }
    }
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: 8 },
      sizeSmall: { lineHeight: "1.8em" },
      inputSizeSmall: { height: "1.8em" },
      notchedOutline: { borderColor: grey[300] }
    }
  },
  MuiButton: {
    variants: [
      {
        props: { color: "dark" },
        style: {
          color: "#fff",
          transition: "all 0.3s",
          backgroundColor: dark.main,
          ":hover": { backgroundColor: dark[800] }
        }
      },
      {
        props: {
          color: "dark",
          variant: "outlined"
        },
        style: {
          color: dark.main,
          borderRadius: 12,
          transition: "all 0.3s",
          backgroundColor: "transparent",
          ":hover": { backgroundColor: alpha(dark.main, 0.1) }
        }
      },
      {
        props: { color: "orange" },
        style: {
          color: "white",
          backgroundColor: orange.main
        }
      },
      {
        props: { color: "success" },
        style: {
          color: "white",
          backgroundColor: success.main
        }
      }
    ],
    defaultProps: { color: "inherit" },
    styleOverrides: {
      sizeSmall: { borderRadius: 6 },
      sizeMedium: { borderRadius: 8 },
      sizeLarge: { padding: ".6rem 2.5rem", borderRadius: 12 },
      root: {
        minWidth: 0,
        minHeight: 0,
        fontWeight: 500,
        textTransform: "capitalize"
      }
    }
  },
  MuiChip: {
    defaultProps: { color: "primary" },
    styleOverrides: {
      labelSmall: { paddingInline: 12 },
      colorSuccess: {
        color: success.main,
        backgroundColor: success[100]
      },
      colorSecondary: {
        color: secondary[500],
        backgroundColor: secondary[100]
      }
    }
  },
  MuiContainer: {
    defaultProps: {
      maxWidth: "xl"
    }
  },
  MuiBackdrop: {
    styleOverrides: {
      invisible: { background: "transparent", backdropFilter: "none" },
      root: {
        backdropFilter: "blur(4px)",
        background:
          "-webkit-linear-gradient(90deg, rgba(75, 85, 99, 0.8) 0%, rgba(55, 65, 81, 0.4) 100%)"
      }
    }
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 12
      }
    }
  },
  MuiAvatar: {
    styleOverrides: {
      rounded: {
        borderRadius: 12
      },
      colorDefault: {
        backgroundColor: grey[50]
      }
    }
  },
  MuiPopover: {
    defaultProps: { elevation: 5 },
    styleOverrides: {
      paper: {
        borderRadius: 8,
        marginTop: 4
      }
    }
  },
  MuiSlider: {
    styleOverrides: {
      valueLabel: {
        borderRadius: 8
      }
    }
  },
  MuiRating: {
    styleOverrides: {
      sizeSmall: {
        fontSize: 16
      }
    }
  }
};
