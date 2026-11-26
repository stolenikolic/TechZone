"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import Share from "@mui/icons-material/Share";
import useWishlist from "hooks/useWishlist";
import { imageActionButtonSx } from "components/wishlist/image-action-button-sx";
import { GalleryActions } from "./styles";

type Props = { productId: string; productName: string };

export default function ProductGalleryActions({ productId, productName }: Props) {
  const { isInWishlist, toggleWishlist, isHydrated } = useWishlist();
  const active = isHydrated && isInWishlist(productId);
  const [copied, setCopied] = useState(false);

  async function shareProduct() {
    const url = window.location.href;
    const payload = { title: productName, url };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <GalleryActions
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <IconButton
        aria-label={copied ? "Link je kopiran" : `Podijeli ${productName}`}
        onClick={() => void shareProduct()}
        sx={imageActionButtonSx}
      >
        <Share fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={active ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
        aria-pressed={active}
        onClick={() => void toggleWishlist(productId)}
        sx={imageActionButtonSx}
      >
        {active ? (
          <Favorite color="primary" fontSize="small" />
        ) : (
          <FavoriteBorder fontSize="small" />
        )}
      </IconButton>
    </GalleryActions>
  );
}
