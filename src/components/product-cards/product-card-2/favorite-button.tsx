"use client";

import { useState } from "react";
// MUI
import Button from "@mui/material/Button";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

export default function FavoriteButton() {
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  const STYLES = {
    height: 0,
    alignItems: "flex-start",
    "&:hover": { backgroundColor: "transparent" }
  };

  return (
    <Button disableRipple disableElevation onClick={handleFavorite} sx={STYLES}>
      {isFavorite ? (
        <Favorite fontSize="small" color="primary" />
      ) : (
        <FavoriteBorder fontSize="small" sx={{ opacity: 0.5 }} />
      )}
    </Button>
  );
}
