"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const Wrapper = styled(Card)(({ theme }) => ({
  width: 500,
  padding: "2rem 3rem",
  border: `1px solid ${theme.palette.grey[100]}`,
  [theme.breakpoints.down("sm")]: { width: "100%" },
  ".agreement": { marginTop: 12, marginBottom: 24 },
  ".social-button": {
    fontWeight: 400,
    padding: "0.5rem 1rem",
    color: theme.palette.text.secondary,
    "&:first-of-type": { marginBottom: "1rem" },
    "& svg": { fontSize: 16 }
  }
}));
