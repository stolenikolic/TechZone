"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import SwapVert from "@mui/icons-material/SwapVert";
import { LISTING_SORT_OPTIONS } from "./listing-sort-options";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function MobileSortButton({ value, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = LISTING_SORT_OPTIONS.find((item) => item.value === value) ?? LISTING_SORT_OPTIONS[0];

  return (
    <>
      <Button
        size="small"
        variant="text"
        aria-label="Sortiraj"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        startIcon={<SwapVert fontSize="small" />}
        sx={{
          flexShrink: 0,
          bgcolor: "grey.50",
          color: "text.primary",
          fontWeight: 500,
          borderRadius: 2,
          px: 2,
          py: 0.75,
          boxShadow: "none",
          whiteSpace: "nowrap",
          "&:hover": {
            bgcolor: "grey.100",
            boxShadow: "none"
          }
        }}
      >
        {current.label}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {LISTING_SORT_OPTIONS.map((item) => (
          <MenuItem
            key={item.value}
            selected={item.value === value}
            onClick={() => {
              onChange(item.value);
              setAnchor(null);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
