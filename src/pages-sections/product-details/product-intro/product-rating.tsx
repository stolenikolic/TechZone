"use client";

import Rating from "@mui/material/Rating";

function ratingLabel(value: number) {
  if (value === 1) return "1 zvjezdica";
  if (value >= 2 && value <= 4) return `${value} zvjezdice`;
  return `${value} zvjezdica`;
}

export default function ProductRating({ value }: { value: number }) {
  return (
    <Rating
      readOnly
      color="warn"
      size="small"
      value={value}
      emptyLabelText="Bez ocjene"
      getLabelText={ratingLabel}
    />
  );
}
