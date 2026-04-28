"use client";

import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
export const Wrapper = styled(Card)(({ theme }) => ({
  margin: "auto",
  padding: "3rem",
  maxWidth: "630px",
  textAlign: "center",
  backgroundColor: theme.palette.grey[50],
  h1: {
    marginTop: "1.5rem",
    lineHeight: 1.1
  }
}));

export const StyledButton = styled(Button)({
  marginTop: "2rem",
  padding: "11px 24px"
});
