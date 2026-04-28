"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

const TableRow = styled(Card)(({ theme }) => ({
  gap: 16,
  display: "grid",
  borderRadius: 12,
  cursor: "pointer",
  alignItems: "center",
  padding: "1rem 1.2rem",
  marginBottom: "1.25rem",
  gridTemplateColumns: "1.5fr 2fr 1.5fr auto",
  border: `1px solid ${theme.palette.grey[100]}`,
  [theme.breakpoints.down("sm")]: {
    gap: 8,
    gridTemplateColumns: "repeat(2, 1fr)"
  },
  ".east": {
    color: theme.palette.grey[500],
    ":dir(rtl) &": { transform: "rotate(180deg)" }
  }
}));

export default TableRow;
