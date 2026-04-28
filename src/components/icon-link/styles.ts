"use client";

import Link from "next/link";
import { styled } from "@mui/material/styles";

export const StyledLink = styled(Link)(({ theme }) => ({
  gap: 4,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  color: theme.palette.grey[700],
  ...(theme.direction === "rtl" && {
    ".icon": { transform: "rotate(180deg)" }
  }),
  ":hover": { textDecoration: "underline" }
}));
