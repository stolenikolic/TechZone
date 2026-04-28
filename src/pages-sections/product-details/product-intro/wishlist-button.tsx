"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

/**
 * Wishlist / Favorite button. Reuses Bazaar template pattern (product-card-2 FavoriteButton).
 * Placed below Add to Cart; keeps template layout spacing.
 */
export default function WishlistButton() {
  const [isFavorite, setFavorite] = useState(false);

  const handleFavorite = () => {
    setFavorite((state) => !state);
  };

  return (
    <Button
      color="primary"
      variant="outlined"
      disableElevation
      onClick={handleFavorite}
      startIcon={isFavorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
      sx={{ mb: 4.5, px: "1.75rem", height: 40 }}
    >
      {isFavorite ? "In Wishlist" : "Add to Wishlist"}
    </Button>
  );
}
