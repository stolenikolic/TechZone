"use client";

import Button from "@mui/material/Button";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import useWishlist from "hooks/useWishlist";

type Props = {
  productId: string;
};

export default function WishlistButton({ productId }: Props) {
  const { isInWishlist, toggleWishlist, isHydrated } = useWishlist();
  const active = isHydrated && isInWishlist(productId);

  return (
    <Button
      color="primary"
      variant="outlined"
      disableElevation
      onClick={() => void toggleWishlist(productId)}
      startIcon={active ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
      sx={{ mb: 4.5, px: "1.75rem", height: 40 }}
    >
      {active ? "U listi želja" : "Dodaj u listu želja"}
    </Button>
  );
}
