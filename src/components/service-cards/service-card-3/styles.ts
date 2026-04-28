"use client";

import { styled } from "@mui/material/styles";

// STYLED COMPONENTS
export const StyledRoot = styled("div")(({ theme }) => ({
  gap: 16,
  flexGrow: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: `1px solid ${theme.palette.divider}`,
  ":last-child": { borderRight: 0 },
  [theme.breakpoints.down("md")]: {
    ":nth-of-type(even)": { borderRight: 0 }
  },
  [theme.breakpoints.down("sm")]: {
    borderRight: 0,
    justifyContent: "flex-start"
  },
  h4: { fontSize: 17, fontWeight: 600 },
  p: { color: theme.palette.grey[600] }
}));
