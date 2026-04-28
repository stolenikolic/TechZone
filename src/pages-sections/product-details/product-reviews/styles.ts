"use client";

import { styled } from "@mui/material/styles";

export const ReviewRoot = styled("div")(({ theme }) => ({
  maxWidth: 600,
  marginBottom: theme.spacing(4),
  "& .user-info": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    "& .user-avatar": { width: 48, height: 48 },
    "& .user-rating": { display: "flex", alignItems: "center", gap: theme.spacing(1.25) }
  }
}));

export const RatingGroup = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2.5)
}));
