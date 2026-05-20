"use client";

import Link from "next/link";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import HeartLine from "icons/HeartLine";
import useWishlist from "hooks/useWishlist";

export function HeaderWishlist() {
  const { count, isHydrated } = useWishlist();

  return (
    <Badge badgeContent={isHydrated ? count : 0} color="primary">
      <IconButton LinkComponent={Link} href="/wish-list" aria-label="Lista želja">
        <HeartLine fontSize="small" />
      </IconButton>
    </Badge>
  );
}
