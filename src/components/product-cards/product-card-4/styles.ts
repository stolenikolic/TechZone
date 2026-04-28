"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card)(() => ({
  height: "100%",
  margin: "auto",
  display: "flex",
  overflow: "hidden",
  borderRadius: "8px",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 250ms ease-in-out",
  "&:hover .controller": { display: "flex", bottom: 20 }
}));

export const HoverWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  left: 0,
  right: 0,
  width: 150,
  bottom: -40,
  margin: "auto",
  borderRadius: 8,
  overflow: "hidden",
  position: "absolute",
  backgroundColor: "#fff",
  boxShadow: theme.shadows[2],
  color: theme.palette.grey[500],
  transition: "bottom 0.3s ease-in-out",
  "& span": { padding: ".5rem" },
  "& svg": { fontSize: 18 },
  "& span, & a": {
    width: "100%",
    height: "100%",
    display: "flex",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": { backgroundColor: theme.palette.action.hover }
  }
}));

export const ImageWrapper = styled("div")(({ theme }) => ({
  minHeight: 288,
  display: "grid",
  overflow: "hidden",
  textAlign: "center",
  position: "relative",
  padding: "44px 40px",
  placeItems: "center",
  backgroundColor: theme.palette.grey[100]
}));

export const ContentWrapper = styled("div")({
  gap: 8,
  display: "flex",
  padding: "1rem",
  ".content": {
    flex: 1,
    paddingTop: "3px",
    overflow: "hidden"
  }
});
