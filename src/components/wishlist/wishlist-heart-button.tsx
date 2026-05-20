"use client";

import IconButton from "@mui/material/IconButton";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import useWishlist from "hooks/useWishlist";

type Props = {
  productId: string;
  size?: "small" | "medium";
  className?: string;
  sx?: object;
};

export default function WishlistHeartButton({ productId, size = "small", className, sx }: Props) {
  const { isInWishlist, toggleWishlist, isHydrated } = useWishlist();
  const active = isHydrated && isInWishlist(productId);

  return (
    <IconButton
      size={size}
      className={[className, active ? "is-active" : ""].filter(Boolean).join(" ") || undefined}
      aria-label={active ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleWishlist(productId);
      }}
      sx={{ position: "absolute", top: 15, right: 15, zIndex: 2, ...sx }}
    >
      {active ? (
        <Favorite color="primary" fontSize="small" />
      ) : (
        <FavoriteBorder fontSize="small" />
      )}
    </IconButton>
  );
}
