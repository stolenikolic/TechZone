"use client";

import { useState } from "react";
// MUI
import IconButton from "@mui/material/IconButton";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

export default function FavoriteButton() {
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  return (
    <IconButton
      size="small"
      onClick={handleFavorite}
      sx={{ position: "absolute", top: 15, right: 15, zIndex: 1 }}
    >
      {isFavorite ? (
        <Favorite color="primary" fontSize="small" />
      ) : (
        <FavoriteBorder fontSize="small" />
      )}
    </IconButton>
  );
}
