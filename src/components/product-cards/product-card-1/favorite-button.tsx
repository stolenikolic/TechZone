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
    <IconButton onClick={handleFavorite}>
      {isFavorite ? (
        <Favorite color="primary" fontSize="small" />
      ) : (
        <FavoriteBorder fontSize="small" color="inherit" />
      )}
    </IconButton>
  );
}
